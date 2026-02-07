export const QUICK_PRESETS = [
  'Solar System toy',
  'Asteroid impact',
  'Fluid lab',
  'Ship test range',
  'Planet atmosphere demo'
] as const;

export const REGRESSION_SCENES = {
  sandPile: { name: 'sand pile', seed: 42 },
  lowGravityFluid: { name: 'liquid in low gravity', seed: 84 },
  asteroidCollision: { name: 'asteroid impact', seed: 128 },
  laserCut: { name: 'laser cut', seed: 211 },
  shipThrust: { name: 'ship thrust', seed: 377 }
};
