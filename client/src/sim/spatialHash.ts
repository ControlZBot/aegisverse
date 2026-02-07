import type { Particle } from './types';

export class SpatialHash {
  private readonly map = new Map<string, number[]>();

  constructor(private readonly cellSize: number) {}

  private key(x: number, y: number, z: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)},${Math.floor(z / this.cellSize)}`;
  }

  rebuild(particles: Particle[]): void {
    this.map.clear();
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const key = this.key(p.x, p.y, p.z);
      const bucket = this.map.get(key);
      if (bucket) bucket.push(i);
      else this.map.set(key, [i]);
    }
  }

  neighbors(p: Particle): number[] {
    const baseX = Math.floor(p.x / this.cellSize);
    const baseY = Math.floor(p.y / this.cellSize);
    const baseZ = Math.floor(p.z / this.cellSize);
    const out: number[] = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const bucket = this.map.get(`${baseX + dx},${baseY + dy},${baseZ + dz}`);
          if (bucket) out.push(...bucket);
        }
      }
    }
    return out;
  }
}
