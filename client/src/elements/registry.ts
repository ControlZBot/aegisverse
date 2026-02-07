import type { ElementSpec, ReactionRule } from '@shared/elements.schema';

type CategorySpec = { name: string; prefixes: string[]; basePhase: ElementSpec['defaultPhase']; hue: number; tags: string[] };

const categories: CategorySpec[] = [
  { name: 'Core materials', prefixes: ['Stone', 'Sand', 'Clay', 'Granite', 'Basalt', 'Limestone', 'Glass', 'Ceramic', 'Carbon', 'Graphite', 'Diamond', 'Regolith'], basePhase: 'solid', hue: 28, tags: ['core', 'solid'] },
  { name: 'Metals', prefixes: ['Iron', 'Aluminum', 'Copper', 'Titanium', 'Nickel', 'Cobalt', 'Alloy', 'Steel', 'Brass', 'Bronze'], basePhase: 'solid', hue: 35, tags: ['metal', 'conductive'] },
  { name: 'Volatiles', prefixes: ['Water', 'SalineWater', 'LightOil', 'HeavyOil', 'Acid', 'Base', 'CryoN2', 'CryoCO2', 'Fuel', 'Oxidizer'], basePhase: 'liquid', hue: 204, tags: ['volatile', 'liquid'] },
  { name: 'Gases', prefixes: ['Oxygen', 'Hydrogen', 'Nitrogen', 'Steam', 'Smoke', 'ToxicGas', 'Argon', 'Neon'], basePhase: 'gas', hue: 190, tags: ['gas'] },
  { name: 'Energetics', prefixes: ['Fire', 'Plasma', 'HotFragment', 'ExplosiveA', 'ExplosiveB', 'OxidizerA', 'OxidizerB'], basePhase: 'plasma', hue: 16, tags: ['energetic'] },
  { name: 'Space', prefixes: ['CometIce', 'StarDust', 'AsteroidMetal', 'MeteorGlass', 'RadiationField'], basePhase: 'solid', hue: 50, tags: ['space'] },
  { name: 'Sci-fi', prefixes: ['Nanite', 'Antimatter', 'DarkMass', 'QuantumFoam', 'VoidSalt'], basePhase: 'solid', hue: 278, tags: ['fictional'] }
];

function buildElements(): ElementSpec[] {
  const elements: ElementSpec[] = [];
  let id = 1;
  for (const category of categories) {
    for (const prefix of category.prefixes) {
      for (let variant = 1; variant <= 3; variant += 1) {
        const key = `${prefix.toLowerCase()}_${variant}`;
        const sat = 10 + variant * 5;
        const light = 38 + ((id + variant) % 4) * 7;
        const phaseBias = category.basePhase === 'gas' ? 0.75 : category.basePhase === 'plasma' ? 1.22 : 1;
        elements.push({
          id: id++,
          key,
          name: `${prefix} ${variant}`,
          category: category.name,
          tags: [...category.tags, prefix.toLowerCase()],
          color: `hsl(${category.hue}, ${sat}%, ${light}%)`,
          renderStyle: category.basePhase === 'solid' ? 'point' : category.basePhase === 'liquid' ? 'billboard' : 'point',
          icon: '◼',
          description: `${prefix} simulation material`,
          warnings: /Antimatter|Explosive|Toxic/i.test(prefix) ? ['high-energy'] : [],
          density: Math.round((760 + variant * 140) * phaseBias),
          massPerParticle: 0.42 + variant * 0.09,
          collisionRadius: category.basePhase === 'gas' ? 0.2 : 0.33,
          thermalConductivity: 0.14 + variant * 0.07,
          specificHeat: 0.88 + variant * 0.07,
          meltingPoint: 220 + variant * 42,
          boilingPoint: 410 + variant * 56,
          latentHeatFusion: 24 + variant * 6,
          latentHeatVaporization: 32 + variant * 7,
          flammability: /Oil|Fuel|Hydrogen|Nanite/i.test(prefix) ? 0.75 : 0.06,
          explosiveness: /Explosive|Antimatter/i.test(prefix) ? 0.92 : 0.04,
          corrosiveness: /Acid|Base/i.test(prefix) ? 0.8 : 0.03,
          radioactivity: /Radiation|DarkMass|Quantum/i.test(prefix) ? 0.4 : 0,
          toxicity: /Toxic|Smoke|Acid|Antimatter/i.test(prefix) ? 0.7 : 0.1,
          electricalConductivity: /Metal|Copper|Steel|Brass|Bronze|Nickel|Cobalt/i.test(prefix) ? 0.82 : 0.2,
          defaultPhase: category.basePhase,
          behaviors: /Nanite/i.test(prefix) ? ['replicates'] : /RadiationField|Plasma/i.test(prefix) ? ['emitsLight'] : []
        });
      }
    }
  }
  return elements;
}

export const ELEMENTS = buildElements();
export const ELEMENT_BY_ID = new Map(ELEMENTS.map((el) => [el.id, el]));
export const ELEMENT_BY_KEY = new Map(ELEMENTS.map((el) => [el.key, el]));

export const REACTION_TABLE: ReactionRule[] = [
  { a: 'fuel_1', b: 'oxidizera_1', minTemp: 450, maxTemp: 3000, probability: 0.55, outputs: ['fire_1', 'smoke_1'], heatDelta: 240, cooldownSteps: 30 },
  { a: 'water_1', b: 'hotfragment_1', minTemp: 300, maxTemp: 2400, probability: 0.45, outputs: ['steam_1'], heatDelta: 90, cooldownSteps: 20 },
  { a: 'iron_1', b: 'acid_1', minTemp: 260, maxTemp: 1000, probability: 0.4, outputs: ['smoke_1', 'smoke_1'], heatDelta: 40, cooldownSteps: 25 },
  { a: 'cryon2_1', b: 'fire_1', minTemp: 273, maxTemp: 1200, probability: 0.35, outputs: ['water_1'], heatDelta: -60, cooldownSteps: 16 },
  { a: 'hydrogen_1', b: 'oxygen_1', minTemp: 520, maxTemp: 1800, probability: 0.35, outputs: ['steam_1', 'fire_1'], heatDelta: 130, cooldownSteps: 24 }
];

export function getElementById(id: number): ElementSpec {
  return ELEMENT_BY_ID.get(id) ?? ELEMENTS[0];
}

export function validateRegistry(): void {
  if (ELEMENTS.length < 150) throw new Error('Element registry must contain at least 150 elements');
  for (const reaction of REACTION_TABLE) {
    if (!ELEMENT_BY_KEY.has(reaction.a) || !ELEMENT_BY_KEY.has(reaction.b)) throw new Error('Reaction table references missing input element');
    for (const output of reaction.outputs) {
      if (!ELEMENT_BY_KEY.has(output)) throw new Error('Reaction table references missing output element');
    }
  }
}
