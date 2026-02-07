import type { QualityPresetName, SimulationMode } from './constants';

export type SerializedWorld = {
  version: 1;
  seed: number;
  time: number;
  mode?: SimulationMode;
  simSpeed?: number;
  quality?: QualityPresetName;
  particles: Array<{
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    t: number;
    e: number;
    phase?: 0 | 1 | 2 | 3;
    pressure?: number;
    internalEnergy?: number;
  }>;
  rigidBodies: Array<{
    id: string;
    kind?: 'planet' | 'moon' | 'asteroid' | 'ship' | 'star' | 'debris';
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    mass: number; radius: number;
    temperature?: number;
    luminosity?: number;
    hp?: number;
  }>;
};

export function serializeWorld(world: SerializedWorld): string {
  return JSON.stringify(world);
}

export function deserializeWorld(raw: string): SerializedWorld {
  const parsed = JSON.parse(raw) as SerializedWorld;
  if (parsed.version !== 1) {
    throw new Error(`Unsupported world version: ${String((parsed as { version?: unknown }).version)}`);
  }
  return parsed;
}
