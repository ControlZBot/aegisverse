import { describe, expect, it } from 'vitest';
import { ELEMENTS, ELEMENT_BY_KEY, REACTION_TABLE, validateRegistry } from '@client/elements/registry';

describe('elements registry', () => {
  it('contains at least 150 element types', () => {
    expect(ELEMENTS.length).toBeGreaterThanOrEqual(150);
  });

  it('schema-like required metadata exists', () => {
    const first = ELEMENTS[0];
    expect(Array.isArray(first.tags)).toBe(true);
    expect(first.description.length).toBeGreaterThan(0);
    expect(first.icon.length).toBeGreaterThan(0);
  });

  it('reaction table references existing keys', () => {
    for (const reaction of REACTION_TABLE) {
      expect(ELEMENT_BY_KEY.has(reaction.a)).toBe(true);
      expect(ELEMENT_BY_KEY.has(reaction.b)).toBe(true);
      for (const out of reaction.outputs) expect(ELEMENT_BY_KEY.has(out)).toBe(true);
    }
  });

  it('registry validation passes', () => {
    expect(() => validateRegistry()).not.toThrow();
  });
});
