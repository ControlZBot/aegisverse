import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDefaultState, stepSimulation, applyPreset, applyLaser, spawnShip, setShipControls } from '@client/sim/engine';
import { PHYSICS_LIMITS, SIM_DT } from '@shared/constants';

const files = [
  'sand-pile.json',
  'liquid-low-gravity.json',
  'asteroid-impact.json',
  'laser-cut.json',
  'ship-thrust.json'
];

describe('10s regression scenarios', () => {
  for (const file of files) {
    it(`runs scene ${file} with invariants`, () => {
      const raw = readFileSync(resolve('scenes/regression', file), 'utf-8');
      const scene = JSON.parse(raw) as { seed: number; preset?: string };
      let state = createDefaultState(scene.seed);
      if (scene.preset) state = applyPreset(state, scene.preset);
      if (file.includes('laser')) applyLaser(state, { x: -8, y: 1, z: 0 }, { x: 1, y: 0.01, z: 0 }, 120);
      if (file.includes('ship')) {
        spawnShip(state);
        setShipControls(state, { thrust: 1, roll: 0.2, boost: true });
      }
      const steps = Math.floor(10 / SIM_DT);
      for (let i = 0; i < steps; i += 1) state = stepSimulation(state);

      expect(state.particles.length).toBeLessThanOrEqual(32000);

      for (const p of state.particles) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.vx)).toBe(true);
        expect(p.t).toBeGreaterThanOrEqual(PHYSICS_LIMITS.minTemperature);
        expect(p.t).toBeLessThanOrEqual(PHYSICS_LIMITS.maxTemperature);
        const speed = Math.hypot(p.vx, p.vy, p.vz);
        expect(speed).toBeLessThanOrEqual(PHYSICS_LIMITS.maxVelocity + 1e-6);
      }

      const epsilon = 0.4;
      for (let i = 0; i < Math.min(200, state.particles.length); i += 1) {
        const a = state.particles[i];
        for (let j = i + 1; j < Math.min(220, state.particles.length); j += 1) {
          const b = state.particles[j];
          if (a.phase === 2 || b.phase === 2) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
          expect(d).toBeGreaterThanOrEqual(0.1 - epsilon);
        }
      }
    });
  }
});
