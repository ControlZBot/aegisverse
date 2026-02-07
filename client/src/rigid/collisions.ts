import type { RigidBody, SimState } from '@client/sim/types';

type Pair = [number, number];

export function solveRigidCollisions(state: SimState, dt: number): void {
  const pairs = broadphasePairs(state.rigidBodies);
  for (const [ai, bi] of pairs) {
    const a = state.rigidBodies[ai];
    const b = state.rigidBodies[bi];
    if (!ccdTest(a, b, dt) && !overlap(a, b)) continue;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const minDist = a.radius + b.radius;
    const nx = dx / dist; const ny = dy / dist; const nz = dz / dist;

    const penetration = Math.max(0, minDist - dist);
    if (penetration > 0) {
      a.x -= nx * penetration * 0.5; a.y -= ny * penetration * 0.5; a.z -= nz * penetration * 0.5;
      b.x += nx * penetration * 0.5; b.y += ny * penetration * 0.5; b.z += nz * penetration * 0.5;
    }

    const rvx = b.vx - a.vx; const rvy = b.vy - a.vy; const rvz = b.vz - a.vz;
    const vn = rvx * nx + rvy * ny + rvz * nz;
    if (vn > 0) continue;

    const restitution = a.kind === 'ship' || b.kind === 'ship' ? 0.16 : 0.42;
    const invA = 1 / Math.max(1e-6, a.mass);
    const invB = 1 / Math.max(1e-6, b.mass);
    const normalImpulse = (-(1 + restitution) * vn) / (invA + invB);

    a.vx -= normalImpulse * nx * invA; a.vy -= normalImpulse * ny * invA; a.vz -= normalImpulse * nz * invA;
    b.vx += normalImpulse * nx * invB; b.vy += normalImpulse * ny * invB; b.vz += normalImpulse * nz * invB;

    const tx = rvx - vn * nx; const ty = rvy - vn * ny; const tz = rvz - vn * nz;
    const tmag = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1e-6;
    const fx = tx / tmag; const fy = ty / tmag; const fz = tz / tmag;
    const mu = 0.2;
    const tangentImpulse = Math.max(-normalImpulse * mu, Math.min(normalImpulse * mu, -(rvx * fx + rvy * fy + rvz * fz) / (invA + invB)));
    a.vx -= tangentImpulse * fx * invA; a.vy -= tangentImpulse * fy * invA; a.vz -= tangentImpulse * fz * invA;
    b.vx += tangentImpulse * fx * invB; b.vy += tangentImpulse * fy * invB; b.vz += tangentImpulse * fz * invB;

    const impactHeat = Math.min(300, Math.abs(vn) * 18);
    a.temperature += impactHeat;
    b.temperature += impactHeat;
  }
}

function broadphasePairs(bodies: RigidBody[]): Pair[] {
  const cellSize = 3;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < bodies.length; i += 1) {
    const b = bodies[i];
    const key = `${Math.floor(b.x / cellSize)},${Math.floor(b.y / cellSize)},${Math.floor(b.z / cellSize)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(i); else grid.set(key, [i]);
  }
  const pairs: Pair[] = [];
  for (const bucket of grid.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) pairs.push([bucket[i], bucket[j]]);
    }
  }
  return pairs;
}

function overlap(a: RigidBody, b: RigidBody): boolean {
  const dx = b.x - a.x; const dy = b.y - a.y; const dz = b.z - a.z;
  return dx * dx + dy * dy + dz * dz < (a.radius + b.radius) ** 2;
}

function ccdTest(a: RigidBody, b: RigidBody, dt: number): boolean {
  const rx = (b.x + b.vx * dt) - (a.x + a.vx * dt);
  const ry = (b.y + b.vy * dt) - (a.y + a.vy * dt);
  const rz = (b.z + b.vz * dt) - (a.z + a.vz * dt);
  const rr = a.radius + b.radius;
  return rx * rx + ry * ry + rz * rz < rr * rr;
}
