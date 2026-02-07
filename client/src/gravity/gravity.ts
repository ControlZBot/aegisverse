import type { SimState } from '@client/sim/types';

const G = 6.674e-2;

export function applyCelestialGravity(state: SimState, dt: number): void {
  const maxAccel = state.mode === 'stable' ? 80 : 260;
  for (let i = 0; i < state.rigidBodies.length; i += 1) {
    const a = state.rigidBodies[i];
    let ax = 0; let ay = 0; let az = 0;
    for (let j = 0; j < state.rigidBodies.length; j += 1) {
      if (i === j) continue;
      const b = state.rigidBodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const distSq = dx * dx + dy * dy + dz * dz + 2;
      const invDist = 1 / Math.sqrt(distSq);
      let accel = G * b.mass / distSq;
      if (state.gravityMode === 'arcade') accel = Math.min(accel, 30);
      ax += dx * invDist * accel;
      ay += dy * invDist * accel;
      az += dz * invDist * accel;
    }
    const mag = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    const clamp = Math.min(1, maxAccel / mag);
    a.vx += ax * clamp * dt;
    a.vy += ay * clamp * dt;
    a.vz += az * clamp * dt;
  }

  for (const p of state.particles) {
    let ax = 0; let ay = 0; let az = 0;
    for (const body of state.rigidBodies) {
      const dx = body.x - p.x;
      const dy = body.y - p.y;
      const dz = body.z - p.z;
      const distSq = dx * dx + dy * dy + dz * dz + body.radius * body.radius;
      const pull = Math.min(7, (body.mass / 140000) / distSq);
      ax += dx * pull;
      ay += dy * pull;
      az += dz * pull;
    }
    p.vx += ax * dt;
    p.vy += ay * dt;
    p.vz += az * dt;
  }
}
