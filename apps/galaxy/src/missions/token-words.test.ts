import { describe, expect, it } from 'vitest';
import { capWords, spentWords, tokensOf } from './token-words';

// A token count in words (PRD 3040 s4): the same words the supervisor writes on a paused mission.

describe('token words', () => {
  it('writes what was spent: 950, 1.1k, 412k, 1.3M, 2.0M', () => {
    expect([950, 1100, 412_000, 1_300_000, 2_000_000].map(spentWords)).toEqual(['950', '1.1k', '412k', '1.3M', '2.0M']);
  });

  it('writes a cap: 500, 1k, 1.5M, 2M', () => {
    expect([500, 1000, 1_500_000, 2_000_000].map(capWords)).toEqual(['500', '1k', '1.5M', '2M']);
  });

  it('reads a field: empty is none, a whole number above 0 is a cap, anything else is refused', () => {
    expect(tokensOf('  ')).toBeNull();
    expect(tokensOf(' 2000000 ')).toBe(2_000_000);
    for (const bad of ['0', '-1', '1.5', '2M', '0123', 'lots']) expect(tokensOf(bad)).toBeUndefined();
  });
});
