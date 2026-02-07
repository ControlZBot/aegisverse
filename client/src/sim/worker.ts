/// <reference lib="webworker" />
import { MAX_CATCHUP_SECONDS, MAX_STEPS_PER_FRAME, SIM_DT } from '@shared/constants';
import { applyExplosion, applyLaser, applyPreset, createDefaultState, setShipControls, spawnShip, stepSimulation } from './engine';
import { deserializeWorld, serializeWorld } from '@shared/serializers';
import type { SimulationMode } from '@shared/constants';

let state = createDefaultState(1337);
let accumulator = 0;
let paused = false;

self.onmessage = (event: MessageEvent) => {
  const msg = event.data as { type: string; payload?: any };

  if (msg.type === 'tick') {
    const frameDt = Math.min(MAX_CATCHUP_SECONDS, Math.max(0, msg.payload?.dt ?? 0));
    if (!paused) {
      accumulator += frameDt;
      let steps = 0;
      while (accumulator >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
        state = stepSimulation(state, SIM_DT);
        accumulator -= SIM_DT;
        steps += 1;
      }
    }
    self.postMessage({ type: 'state', payload: state });
    return;
  }

  if (msg.type === 'pause') paused = Boolean(msg.payload?.paused);
  if (msg.type === 'reset') state = createDefaultState(msg.payload?.seed ?? 1337);
  if (msg.type === 'mode') state.mode = (msg.payload?.mode ?? 'stable') as SimulationMode;
  if (msg.type === 'gravityMode') state.gravityMode = msg.payload?.mode ?? 'arcade';
  if (msg.type === 'quality') state.quality = msg.payload?.quality ?? 'medium';
  if (msg.type === 'simSpeed') state.simSpeed = Math.max(0.1, Math.min(4, Number(msg.payload?.speed ?? 1)));
  if (msg.type === 'explosion') applyExplosion(state, { x: msg.payload?.x ?? 0, y: msg.payload?.y ?? 0, z: msg.payload?.z ?? 0 }, msg.payload?.power ?? 20);
  if (msg.type === 'laser') applyLaser(state, { x: msg.payload?.ox ?? 0, y: msg.payload?.oy ?? 0, z: msg.payload?.oz ?? 0 }, { x: msg.payload?.dx ?? 1, y: msg.payload?.dy ?? 0, z: msg.payload?.dz ?? 0 }, msg.payload?.heat ?? 20);
  if (msg.type === 'ship') spawnShip(state);
  if (msg.type === 'shipControl') setShipControls(state, msg.payload ?? { thrust: 0, roll: 0, boost: false });
  if (msg.type === 'preset') state = applyPreset(state, msg.payload?.preset ?? '');

  if (msg.type === 'export') {
    self.postMessage({
      type: 'export',
      payload: serializeWorld({
        version: 1,
        seed: state.seed,
        time: state.time,
        mode: state.mode,
        simSpeed: state.simSpeed,
        quality: state.quality,
        particles: state.particles,
        rigidBodies: state.rigidBodies
      })
    });
  }

  if (msg.type === 'import') {
    try {
      const parsed = deserializeWorld(msg.payload?.json ?? '');
      state = {
        ...state,
        seed: parsed.seed,
        time: parsed.time,
        mode: parsed.mode ?? 'stable',
        simSpeed: parsed.simSpeed ?? 1,
        quality: parsed.quality ?? 'medium',
        particles: parsed.particles.map((p) => ({ ...p, phase: p.phase ?? 0, phaseCooldown: 0, pressure: p.pressure ?? 101325, internalEnergy: p.internalEnergy ?? 1500 })),
        rigidBodies: parsed.rigidBodies.map((rb) => ({
          ...rb,
          kind: rb.kind ?? 'asteroid',
          temperature: rb.temperature ?? 290,
          luminosity: rb.luminosity ?? 0,
          hp: rb.hp ?? 100,
          sleeping: false
        }))
      };
    } catch {
      state.warnings = ['Import failed: invalid JSON world file.'];
    }
  }
};
