import { PHYSICS_LIMITS, QUALITY_PRESETS, SIM_DT, type SimulationMode } from '@shared/constants';
import { applyCelestialGravity } from '@client/gravity/gravity';
import { applyHeat } from '@client/heat/heat';
import { applySimplifiedFluids } from '@client/fluids/fluids';
import { solveRigidCollisions } from '@client/rigid/collisions';
import { SpatialHash } from './spatialHash';
import type { Particle, RigidBody, SimState } from './types';
import { getElementById, validateRegistry } from '@client/elements/registry';
import { Mulberry32 } from '@client/core/rng';
import { applyReactions } from './reactions';
import { reportHealthEvent, resetHealthForStep } from './health';

const WORLD_BOUNDS = 120;
let registryValidated = false;

export function createDefaultState(seed: number): SimState {
  if (!registryValidated) {
    validateRegistry();
    registryValidated = true;
  }
  const rng = new Mulberry32(seed);
  const particles: Particle[] = [];
  for (let i = 0; i < 3200; i += 1) {
    const r = 9 + rng.next() * 4;
    const angle = rng.next() * Math.PI * 2;
    particles.push({
      x: Math.cos(angle) * r,
      y: (rng.next() - 0.5) * 1.2,
      z: Math.sin(angle) * r,
      vx: (rng.next() - 0.5) * 0.02,
      vy: (rng.next() - 0.5) * 0.02,
      vz: (rng.next() - 0.5) * 0.02,
      t: 285 + rng.next() * 15,
      pressure: PHYSICS_LIMITS.defaultPressure,
      internalEnergy: 1500,
      e: 1 + (i % 165),
      phase: 0,
      phaseCooldown: 0
    });
  }

  return {
    seed,
    rngState: seed >>> 0,
    time: 0,
    mode: 'stable',
    gravityMode: 'arcade',
    simSpeed: 1,
    quality: 'medium',
    particles,
    rigidBodies: [
      { id: 'star', kind: 'star', x: -22, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mass: 75000, radius: 4.5, temperature: 5100, luminosity: 1.6, hp: 99999, sleeping: false },
      { id: 'planet', kind: 'planet', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mass: 53000, radius: 3.3, temperature: 320, luminosity: 0.1, hp: 99999, sleeping: false },
      { id: 'moon', kind: 'moon', x: 16, y: 0, z: 0, vx: 0, vy: 0, vz: 16.8, mass: 7000, radius: 1.4, temperature: 210, luminosity: 0, hp: 99999, sleeping: false }
    ],
    warnings: [],
    perf: { tickMs: 0, steps: 0 },
    health: { status: 'ok', events: [] }
  };
}

export function stepSimulation(state: SimState, dt = SIM_DT): SimState {
  const start = performance.now();
  const backup = cloneState(state);
  resetHealthForStep(state);

  const quality = QUALITY_PRESETS[state.quality];
  const hash = new SpatialHash(0.85);
  hash.rebuild(state.particles);

  const scaledDt = dt * state.simSpeed;
  applyCelestialGravity(state, scaledDt);
  solveRigidCollisions(state, scaledDt);
  applyHeat(state, hash, scaledDt);
  applySimplifiedFluids(state, hash, scaledDt, quality.fluidNeighbors);
  applyReactions(state, hash);

  integrateRigidBodies(state, scaledDt);
  solveParticleXPBD(state, hash, scaledDt, state.mode);
  integrateParticles(state, scaledDt);
  runFragmentation(state, quality.fragmentCap);

  state.time += scaledDt;
  state.perf.tickMs = performance.now() - start;
  state.perf.steps += 1;
  state.warnings = state.health.events;

  if (!validateState(state)) {
    const recovered = cloneState(backup);
    reportHealthEvent(recovered, 'rollback_invalid_numeric_state', recovered.time);
    recovered.warnings = [...recovered.health.events];
    return recovered;
  }

  return state;
}

function solveParticleXPBD(state: SimState, hash: SpatialHash, dt: number, mode: SimulationMode): void {
  const iterations = mode === 'stable' ? PHYSICS_LIMITS.pbdIterationsStable : PHYSICS_LIMITS.pbdIterationsAdvanced;
  const complianceSolid = mode === 'stable' ? 0.0002 : 0.0001;
  const complianceLiquid = mode === 'stable' ? 0.002 : 0.001;
  const complianceGas = mode === 'stable' ? 0.01 : 0.008;

  for (let iter = 0; iter < iterations; iter += 1) {
    for (let i = 0; i < state.particles.length; i += 1) {
      const p = state.particles[i];
      const neighbors = hash.neighbors(p).slice(0, 26);
      for (const ni of neighbors) {
        if (ni <= i) continue;
        const n = state.particles[ni];
        const dx = n.x - p.x;
        const dy = n.y - p.y;
        const dz = n.z - p.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const minDist = phaseDistance(p.phase, n.phase);
        if (dist >= minDist) continue;

        const stiffness = phaseStiffness(p.phase, n.phase);
        const compliance = p.phase === 2 || n.phase === 2 ? complianceGas : p.phase === 1 || n.phase === 1 ? complianceLiquid : complianceSolid;
        const c = dist - minDist;
        const lambda = -c / (2 + compliance / (dt * dt));
        const corr = lambda * stiffness;
        const nx = dx / dist; const ny = dy / dist; const nz = dz / dist;

        p.x -= nx * corr;
        p.y -= ny * corr;
        p.z -= nz * corr;
        n.x += nx * corr;
        n.y += ny * corr;
        n.z += nz * corr;
      }
    }
  }
}

function integrateParticles(state: SimState, dt: number): void {
  const gravity = state.gravityMode === 'arcade' ? 0.9 : 1.5;
  for (const p of state.particles) {
    p.vy -= gravity * dt;
    p.vx = clamp(p.vx, -PHYSICS_LIMITS.maxVelocity, PHYSICS_LIMITS.maxVelocity);
    p.vy = clamp(p.vy, -PHYSICS_LIMITS.maxVelocity, PHYSICS_LIMITS.maxVelocity);
    p.vz = clamp(p.vz, -PHYSICS_LIMITS.maxVelocity, PHYSICS_LIMITS.maxVelocity);

    p.x = clamp(p.x + p.vx * dt, -WORLD_BOUNDS, WORLD_BOUNDS);
    p.y = clamp(p.y + p.vy * dt, -WORLD_BOUNDS, WORLD_BOUNDS);
    p.z = clamp(p.z + p.vz * dt, -WORLD_BOUNDS, WORLD_BOUNDS);

    const element = getElementById(p.e);
    const canSwitch = p.phaseCooldown <= 0;
    const boilTrigger = element.boilingPoint + 8;
    const condenseTrigger = element.boilingPoint - 12;
    const meltTrigger = element.meltingPoint + 6;
    const freezeTrigger = element.meltingPoint - 10;

    if (canSwitch) {
      if (p.phase < 2 && p.t >= boilTrigger) {
        p.phase = 2;
        p.internalEnergy -= element.latentHeatVaporization;
        p.phaseCooldown = 15;
      } else if (p.phase === 2 && p.t < condenseTrigger) {
        p.phase = 1;
        p.internalEnergy += element.latentHeatVaporization * 0.6;
        p.phaseCooldown = 15;
      } else if (p.phase === 0 && p.t >= meltTrigger) {
        p.phase = 1;
        p.internalEnergy -= element.latentHeatFusion;
        p.phaseCooldown = 12;
      } else if (p.phase === 1 && p.t <= freezeTrigger) {
        p.phase = 0;
        p.internalEnergy += element.latentHeatFusion * 0.6;
        p.phaseCooldown = 12;
      }
    }
    p.phaseCooldown = Math.max(0, p.phaseCooldown - 1);
  }
}

function integrateRigidBodies(state: SimState, dt: number): void {
  for (const rb of state.rigidBodies) {
    rb.vx = clamp(rb.vx, -PHYSICS_LIMITS.maxVelocity, PHYSICS_LIMITS.maxVelocity);
    rb.vy = clamp(rb.vy, -PHYSICS_LIMITS.maxVelocity, PHYSICS_LIMITS.maxVelocity);
    rb.vz = clamp(rb.vz, -PHYSICS_LIMITS.maxVelocity, PHYSICS_LIMITS.maxVelocity);

    rb.x = clamp(rb.x + rb.vx * dt, -WORLD_BOUNDS, WORLD_BOUNDS);
    rb.y = clamp(rb.y + rb.vy * dt, -WORLD_BOUNDS, WORLD_BOUNDS);
    rb.z = clamp(rb.z + rb.vz * dt, -WORLD_BOUNDS, WORLD_BOUNDS);

    rb.temperature = clamp(rb.temperature, PHYSICS_LIMITS.minTemperature, PHYSICS_LIMITS.maxTemperature);
  }
}

function runFragmentation(state: SimState, fragmentCap: number): void {
  if (state.mode === 'stable' || fragmentCap <= 0) return;
  let fragments = 0;
  const spawned: RigidBody[] = [];
  for (const rb of state.rigidBodies) {
    if (rb.kind !== 'asteroid') continue;
    const speed = Math.hypot(rb.vx, rb.vy, rb.vz);
    if (speed < 80 || rb.radius < 0.8) continue;
    rb.radius *= 0.7;
    rb.hp -= 20;
    for (let i = 0; i < 2 && fragments < fragmentCap; i += 1) {
      fragments += 1;
      spawned.push({
        id: `${rb.id}-shard-${fragments}`,
        kind: 'debris',
        x: rb.x + (i === 0 ? 0.4 : -0.4),
        y: rb.y,
        z: rb.z,
        vx: rb.vx * 0.6 + (i === 0 ? 5 : -5),
        vy: rb.vy * 0.6 + 2,
        vz: rb.vz * 0.6,
        mass: rb.mass * 0.08,
        radius: rb.radius * 0.35,
        temperature: rb.temperature + 50,
        luminosity: 0,
        hp: 20,
        sleeping: false
      });
    }
  }
  state.rigidBodies.push(...spawned);
}

export function applyExplosion(state: SimState, at: { x: number; y: number; z: number }, power: number): void {
  const cappedPower = clamp(power, 0, 100);
  for (let sub = 0; sub < 3; sub += 1) {
    for (const p of state.particles) {
      const dx = p.x - at.x;
      const dy = p.y - at.y;
      const dz = p.z - at.z;
      const distSq = dx * dx + dy * dy + dz * dz + 0.3;
      const impulse = Math.min(40, cappedPower / distSq);
      const inv = 1 / Math.sqrt(distSq);
      p.vx += dx * inv * impulse * 0.02;
      p.vy += dy * inv * impulse * 0.02;
      p.vz += dz * inv * impulse * 0.02;
      p.t = clamp(p.t + impulse * 10, PHYSICS_LIMITS.minTemperature, PHYSICS_LIMITS.maxTemperature);
    }
  }
}

export function applyLaser(state: SimState, origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, heat: number): void {
  const mag = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const nx = dir.x / mag; const ny = dir.y / mag; const nz = dir.z / mag;
  for (const p of state.particles) {
    const ox = p.x - origin.x; const oy = p.y - origin.y; const oz = p.z - origin.z;
    const t = ox * nx + oy * ny + oz * nz;
    if (t < 0 || t > 60) continue;
    const px = origin.x + nx * t; const py = origin.y + ny * t; const pz = origin.z + nz * t;
    const d = Math.hypot(p.x - px, p.y - py, p.z - pz);
    if (d < 0.32) {
      p.t = clamp(p.t + heat, PHYSICS_LIMITS.minTemperature, PHYSICS_LIMITS.maxTemperature);
      p.vx += nx * 0.16;
      p.vy += ny * 0.16;
      p.vz += nz * 0.16;
    }
  }
}

export function spawnShip(state: SimState): void {
  state.rigidBodies.push({
    id: `ship-${state.rigidBodies.length}`,
    kind: 'ship',
    x: 6,
    y: 2,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 8,
    mass: 120,
    radius: 0.8,
    temperature: 295,
    luminosity: 0,
    hp: 100,
    sleeping: false
  });
}

export function setShipControls(state: SimState, control: { thrust: number; roll: number; boost: boolean }): void {
  const ship = state.rigidBodies.find((b) => b.kind === 'ship');
  if (!ship) return;
  const thrust = clamp(control.thrust, -1, 1) * (control.boost ? 24 : 12);
  ship.vz += thrust * 0.05;
  ship.vx += clamp(control.roll, -1, 1) * 0.05;
  ship.temperature += Math.abs(thrust) * 0.04;
}

export function applyPreset(state: SimState, preset: string): SimState {
  if (preset === 'Asteroid impact') {
    state.rigidBodies.push({ id: 'asteroid', kind: 'asteroid', x: 40, y: 2, z: 0, vx: -28, vy: -1, vz: 0, mass: 4200, radius: 1.8, temperature: 190, luminosity: 0, hp: 80, sleeping: false });
  }
  if (preset === 'Fluid lab') {
    for (let i = 0; i < Math.min(900, state.particles.length); i += 1) {
      state.particles[i].phase = 1;
      state.particles[i].t = 305;
      state.particles[i].y = 1 + (i % 50) * 0.04;
    }
  }
  if (preset === 'Ship test range') spawnShip(state);
  if (preset === 'Solar System toy') {
    state.mode = 'stable';
    state.gravityMode = 'newtonian';
  }

  if (preset === 'Planet atmosphere demo') {
    state.particles.forEach((p, i) => {
      if (i % 3 === 0) {
        p.phase = 2;
        p.t = 340;
        p.y = Math.abs(p.y) + 1.5;
      }
    });
  }
  return state;
}

function phaseDistance(a: number, b: number): number {
  if (a === 2 || b === 2) return 0.1;
  if (a === 1 || b === 1) return 0.24;
  return 0.32;
}

function phaseStiffness(a: number, b: number): number {
  if (a === 2 || b === 2) return 0.2;
  if (a === 1 || b === 1) return 0.55;
  return 0.9;
}

function validateState(state: SimState): boolean {
  const finitePos = (n: number) => Number.isFinite(n) && Math.abs(n) <= PHYSICS_LIMITS.maxPositionAbs;
  if (state.particles.length > MAX_PARTICLE_CAP(state)) return false;

  for (const p of state.particles) {
    if (!finitePos(p.x) || !finitePos(p.y) || !finitePos(p.z)) return false;
    if (!Number.isFinite(p.vx) || !Number.isFinite(p.vy) || !Number.isFinite(p.vz)) return false;
    if (!Number.isFinite(p.t) || p.t < PHYSICS_LIMITS.minTemperature || p.t > PHYSICS_LIMITS.maxTemperature) return false;
  }
  for (const rb of state.rigidBodies) {
    if (!finitePos(rb.x) || !finitePos(rb.y) || !finitePos(rb.z)) return false;
    if (!Number.isFinite(rb.vx) || !Number.isFinite(rb.vy) || !Number.isFinite(rb.vz)) return false;
  }
  return true;
}

function MAX_PARTICLE_CAP(state: SimState): number {
  return QUALITY_PRESETS[state.quality].maxParticles;
}

function cloneState(state: SimState): SimState {
  return {
    ...state,
    particles: state.particles.map((p) => ({ ...p })),
    rigidBodies: state.rigidBodies.map((rb) => ({ ...rb })),
    warnings: [...state.warnings],
    perf: { ...state.perf },
    health: { status: state.health.status, events: [...state.health.events] }
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
