import { describe, expect, it } from 'vitest';
import { createDefaultState, stepSimulation, applyPreset } from '@client/sim/engine';

describe('legacy regression scenes', () => {
  it('asteroid impact remains bounded', () => {
    let state = applyPreset(createDefaultState(128), 'Asteroid impact');
    for (let i = 0; i < 600; i += 1) state = stepSimulation(state);
    const maxVel = Math.max(...state.particles.map((p) => Math.hypot(p.vx, p.vy, p.vz)));
    expect(maxVel).toBeLessThan(260);
  });
});
