export const SIM_DT = 1 / 120;
export const MAX_CATCHUP_SECONDS = 0.2;
export const MAX_STEPS_PER_FRAME = 12;
export const MAX_PARTICLES = 32000;

export const PHYSICS_LIMITS = {
  maxVelocity: 220,
  maxAcceleration: 520,
  minTemperature: 2,
  maxTemperature: 12000,
  maxPositionAbs: 5000,
  defaultPressure: 101325,
  collisionIterations: 5,
  pbdIterationsStable: 3,
  pbdIterationsAdvanced: 8,
  reactionCapStable: 120,
  reactionCapAdvanced: 360,
  fragmentationCapStable: 0,
  fragmentationCapAdvanced: 24
} as const;

export const QUALITY_PRESETS = {
  low: { maxParticles: 5000, iterations: 2, fluidNeighbors: 10, reactionCap: 80, fragmentCap: 4, lodNear: 14, lodFar: 50 },
  medium: { maxParticles: 12000, iterations: 4, fluidNeighbors: 16, reactionCap: 160, fragmentCap: 10, lodNear: 18, lodFar: 70 },
  high: { maxParticles: 20000, iterations: 6, fluidNeighbors: 24, reactionCap: 280, fragmentCap: 16, lodNear: 24, lodFar: 100 },
  ultra: { maxParticles: 28000, iterations: 8, fluidNeighbors: 32, reactionCap: 420, fragmentCap: 24, lodNear: 32, lodFar: 130 }
} as const;

export type QualityPresetName = keyof typeof QUALITY_PRESETS;
export type SimulationMode = 'stable' | 'advanced';
