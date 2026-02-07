import { PHYSICS_LIMITS } from '@shared/constants';
import { ELEMENT_BY_KEY, REACTION_TABLE } from '@client/elements/registry';
import { SpatialHash } from './spatialHash';
import type { SimState } from './types';

type PairCooldowns = Map<string, number>;
const pairCooldowns: PairCooldowns = new Map();

function key(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function applyReactions(state: SimState, hash: SpatialHash): void {
  const cap = state.mode === 'stable' ? PHYSICS_LIMITS.reactionCapStable : PHYSICS_LIMITS.reactionCapAdvanced;
  let executed = 0;
  const nowStep = state.perf.steps;

  for (let i = 0; i < state.particles.length && executed < cap; i += 1) {
    const p = state.particles[i];
    const neighbors = hash.neighbors(p).slice(0, 12);
    for (const ni of neighbors) {
      if (ni <= i) continue;
      const n = state.particles[ni];
      const cooldownKey = key(i, ni);
      if ((pairCooldowns.get(cooldownKey) ?? 0) > nowStep) continue;
      const aKey = `${elementKey(p.e)}`;
      const bKey = `${elementKey(n.e)}`;
      for (const reaction of REACTION_TABLE) {
        const match = (reaction.a === aKey && reaction.b === bKey) || (reaction.a === bKey && reaction.b === aKey);
        if (!match || p.t < reaction.minTemp || p.t > reaction.maxTemp) continue;
        const roll = deterministicNoise(state, i, ni);
        if (roll > reaction.probability) continue;
        const output = ELEMENT_BY_KEY.get(reaction.outputs[0]);
        if (output) {
          p.e = output.id;
          p.t = Math.min(PHYSICS_LIMITS.maxTemperature, Math.max(PHYSICS_LIMITS.minTemperature, p.t + reaction.heatDelta));
        }
        pairCooldowns.set(cooldownKey, nowStep + reaction.cooldownSteps);
        executed += 1;
        if (executed >= cap) break;
      }
      if (executed >= cap) break;
    }
  }
}

function deterministicNoise(state: SimState, i: number, j: number): number {
  let x = (state.rngState ^ (i * 73856093) ^ (j * 19349663)) >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function elementKey(id: number): string {
  for (const [keyName, spec] of ELEMENT_BY_KEY) {
    if (spec.id === id) return keyName;
  }
  return 'stone_1';
}
