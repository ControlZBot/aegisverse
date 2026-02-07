import { PHYSICS_LIMITS } from '@shared/constants';
import { getElementById } from '@client/elements/registry';
import type { SimState } from '@client/sim/types';
import { SpatialHash } from '@client/sim/spatialHash';

export function applyHeat(state: SimState, hash: SpatialHash, dt: number): void {
  const radiativeScale = state.mode === 'stable' ? 0.00045 : 0.00075;

  for (const p of state.particles) {
    const neighbors = hash.neighbors(p).slice(0, 18);
    for (const i of neighbors) {
      const n = state.particles[i];
      if (n === p) continue;
      const k = (getElementById(p.e).thermalConductivity + getElementById(n.e).thermalConductivity) * 0.5;
      const dQ = k * (n.t - p.t) * dt * 0.08;
      p.t += dQ;
      p.internalEnergy += dQ * 0.3;
    }

    for (const body of state.rigidBodies) {
      const dx = p.x - body.x;
      const dy = p.y - body.y;
      const dz = p.z - body.z;
      const distSq = dx * dx + dy * dy + dz * dz + 1;
      p.t += ((body.temperature - p.t) * body.luminosity * radiativeScale) / distSq;
      body.temperature -= Math.max(0, body.temperature - 290) * 0.000001;
    }

    p.t = Math.min(PHYSICS_LIMITS.maxTemperature, Math.max(PHYSICS_LIMITS.minTemperature, p.t));
    p.internalEnergy = Math.max(0, Math.min(2_000_000, p.internalEnergy));
  }
}
