import type { SimState } from '@client/sim/types';
import { SpatialHash } from '@client/sim/spatialHash';

export function applySimplifiedFluids(state: SimState, hash: SpatialHash, dt: number, neighborCap: number): void {
  const viscosity = state.mode === 'stable' ? 0.08 : 0.05;
  const pressureScale = state.mode === 'stable' ? 0.0025 : 0.0048;
  const xsph = state.mode === 'stable' ? 0.08 : 0.14;

  for (const p of state.particles) {
    if (p.phase !== 1 && p.phase !== 2) continue;
    const neighbors = hash.neighbors(p).slice(0, neighborCap);
    let avgVx = 0; let avgVy = 0; let avgVz = 0;
    let density = 0;

    for (const ni of neighbors) {
      const n = state.particles[ni];
      if (n === p) continue;
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      const dz = n.z - p.z;
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 > 1.44) continue;
      const w = 1 - Math.min(1, Math.sqrt(r2) / 1.2);
      density += w;
      avgVx += n.vx * w;
      avgVy += n.vy * w;
      avgVz += n.vz * w;
      if (p.phase === 1) {
        const pressure = Math.max(-0.8, Math.min(1.2, (density - 5) * pressureScale));
        p.vx -= dx * pressure * dt;
        p.vy -= dy * pressure * dt;
        p.vz -= dz * pressure * dt;
      }
    }

    if (density > 0.001) {
      const inv = 1 / density;
      const targetVx = avgVx * inv;
      const targetVy = avgVy * inv;
      const targetVz = avgVz * inv;
      p.vx += (targetVx - p.vx) * (viscosity + xsph) * dt * 60;
      p.vy += (targetVy - p.vy) * (viscosity + xsph) * dt * 60;
      p.vz += (targetVz - p.vz) * (viscosity + xsph) * dt * 60;
      p.pressure = 101325 + density * Math.max(0, p.t) * 8;
    }

    if (state.mode === 'advanced' && p.phase === 1) {
      p.vy += Math.min(0.04, Math.max(0, p.t - 360) * 0.0001) * dt;
    }
    if (p.phase === 2) p.vy += Math.max(0, p.t - 320) * 0.00022 * dt;
  }
}
