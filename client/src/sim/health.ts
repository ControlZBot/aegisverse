import type { SimState } from './types';

type EventMap = Map<string, number>;
const reportedAt: EventMap = new Map();

export function reportHealthEvent(state: SimState, code: string, now: number): void {
  const last = reportedAt.get(code) ?? -Infinity;
  if (now - last < 1.5) return;
  reportedAt.set(code, now);
  state.health.status = 'warning';
  state.health.events.push(code);
  state.health.events = state.health.events.slice(-8);
}

export function resetHealthForStep(state: SimState): void {
  state.health.status = 'ok';
}
