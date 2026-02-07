export type ElementPhase = 'solid' | 'liquid' | 'gas' | 'plasma';

export type ElementSpec = {
  id: number;
  key: string;
  name: string;
  category: string;
  tags: string[];
  color: string;
  renderStyle: 'point' | 'billboard' | 'mesh';
  icon: string;
  description: string;
  warnings: string[];
  density: number;
  massPerParticle: number;
  collisionRadius: number;
  thermalConductivity: number;
  specificHeat: number;
  meltingPoint: number;
  boilingPoint: number;
  latentHeatFusion: number;
  latentHeatVaporization: number;
  flammability: number;
  explosiveness: number;
  corrosiveness: number;
  radioactivity: number;
  toxicity: number;
  electricalConductivity: number;
  defaultPhase: ElementPhase;
  behaviors?: string[];
};

export type ReactionRule = {
  a: string;
  b: string;
  minTemp: number;
  maxTemp: number;
  probability: number;
  outputs: string[];
  heatDelta: number;
  cooldownSteps: number;
};
