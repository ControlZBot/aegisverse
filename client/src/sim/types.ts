import type { QualityPresetName, SimulationMode } from '@shared/constants';

export type Particle = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  t: number;
  pressure: number;
  internalEnergy: number;
  e: number;
  phase: 0 | 1 | 2 | 3;
  phaseCooldown: number;
};

export type RigidBodyType = 'planet' | 'moon' | 'asteroid' | 'ship' | 'star' | 'debris';

export type RigidBody = {
  id: string;
  kind: RigidBodyType;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  mass: number;
  radius: number;
  temperature: number;
  luminosity: number;
  hp: number;
  sleeping: boolean;
};

export type PerfStats = { tickMs: number; steps: number };
export type SimHealth = { status: 'ok' | 'warning'; events: string[] };

export type SimState = {
  seed: number;
  rngState: number;
  time: number;
  mode: SimulationMode;
  gravityMode: 'arcade' | 'newtonian';
  simSpeed: number;
  quality: QualityPresetName;
  particles: Particle[];
  rigidBodies: RigidBody[];
  warnings: string[];
  perf: PerfStats;
  health: SimHealth;
};

export type DebugState = {
  colliders: boolean;
  grid: boolean;
  velocity: boolean;
  thermal: boolean;
};
