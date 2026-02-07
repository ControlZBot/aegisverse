import { describe, expect, it } from 'vitest';
import { createDefaultState, stepSimulation } from '@client/sim/engine';

describe('simulation invariants', () => {
  it('stays finite for 10 seconds', () => {
    let state = createDefaultState(1234);
    for (let i = 0; i < 1200; i += 1) state = stepSimulation(state);
    for (const p of state.particles) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.vx)).toBe(true);
      expect(Number.isFinite(p.t)).toBe(true);
    }
  });

  it('is deterministic with same seed', () => {
    let a = createDefaultState(9);
    let b = createDefaultState(9);
    for (let i = 0; i < 300; i += 1) {
      a = stepSimulation(a);
      b = stepSimulation(b);
    }
    expect(a.particles[50].x).toBeCloseTo(b.particles[50].x, 8);
    expect(a.rigidBodies[1].z).toBeCloseTo(b.rigidBodies[1].z, 8);
  });

  it('stable mode remains default', () => {
    const state = createDefaultState(77);
    expect(state.mode).toBe('stable');
  });
});
