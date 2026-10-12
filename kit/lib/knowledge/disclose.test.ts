// PRD 1726, s2: disclosure reads `Governs:` with the flow areas' own matcher, and a headline is one sentence.
import { describe, expect, it } from 'vitest';
import { governsPath, headline, invalidGoverns, lawLine } from './disclose.ts';

describe('governsPath — the flow areas’ matcher', () => {
  it('matches a path any pattern matches, as an unanchored regular expression', () => {
    expect(governsPath(['^kit/lib/outbox/'], 'kit/lib/outbox/gate.ts')).toBe(true);
    expect(governsPath(['^kit/lib/outbox/'], 'apps/kit/lib/outbox/gate.ts')).toBe(false);
    expect(governsPath(['outbox/'], 'apps/kit/lib/outbox/gate.ts')).toBe(true);
    expect(governsPath(['^a/', '^b\\.ts$'], 'b.ts')).toBe(true);
    expect(governsPath(['^b\\.ts$'], 'b.tsx')).toBe(false);
  });

  it('matches nothing for a pattern that does not compile, nor for none', () => {
    expect(governsPath(['game/**'], 'game/ledger.ts')).toBe(false);
    expect(governsPath(['game/**', '^game/'], 'game/ledger.ts')).toBe(true);
    expect(governsPath([], 'game/ledger.ts')).toBe(false);
  });

  it('names each pattern that is not a regular expression', () => {
    expect(invalidGoverns(['^game/', 'game/**', '('])).toEqual(['game/**', '(']);
  });
});

describe('headline and lawLine', () => {
  it('keeps the first sentence of a statement', () => {
    expect(headline('One thing. Then another.')).toBe('One thing.');
    expect(headline('Is it? Yes.')).toBe('Is it?');
    expect(headline('No stop at all')).toBe('No stop at all');
    expect(headline('v1.2 stays. Then.')).toBe('v1.2 stays.');
  });

  it('names who must approve a change, a team as written', () => {
    const law = { id: 'BR-X-1', file: 'f', sentence: 'It holds.', lockedBy: 'a', lockedOn: '2026-10-14', governs: [] };
    expect(lawLine(law, ['pierre', '@acme/core'])).toBe('law BR-X-1 — It holds. Changing it needs @pierre or @acme/core to approve the pull request.');
    expect(lawLine(law, [])).toBe('law BR-X-1 — It holds. Changing it needs its owner to approve the pull request.');
  });
});
