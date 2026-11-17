// A repair's retro (PRD 2980 s1): `RepairRetroSchema` takes a whole retro and refuses a part missing, a class of its own, an
// evidence line longer than one sentence, and a credential held in clear (L-GDPR-2).
import { describe, expect, it } from 'vitest';
import { RepairRetroSchema, isOneSentence, type RepairRetro } from './retro.ts';

const retro = (over: Partial<RepairRetro> = {}): RepairRetro => ({
  cause: 'The sum test expects the old rounding.',
  class: 'code',
  place: 'kit/lib/sum.test.ts',
  signature: 'AssertionError: expected 3 to be 4',
  evidence: ['The test failed on the rounding branch only.', 'The rounding changed in the last commit.'],
  proposedFix: 'Round half up in sum() as the spec says.',
  fingerprint: 'a'.repeat(64),
  ...over,
});

const refuses = (value: unknown): boolean => !RepairRetroSchema.safeParse(value).success;

describe('RepairRetroSchema', () => {
  it('takes a whole retro', () => {
    expect(RepairRetroSchema.parse(retro())).toEqual(retro());
  });

  it('refuses a retro missing its cause, class, place, signature, evidence, proposed fix or fingerprint', () => {
    for (const key of ['cause', 'class', 'place', 'signature', 'evidence', 'proposedFix', 'fingerprint'] as const) {
      const rest = Object.fromEntries(Object.entries(retro()).filter(([name]) => name !== key));
      expect(refuses(rest), key).toBe(true);
    }
    expect(refuses(retro({ cause: '' }))).toBe(true);
    expect(refuses(retro({ place: '  ' }))).toBe(true);
    expect(refuses(retro({ evidence: [] }))).toBe(true);
  });

  it('takes the four classes, and refuses any other', () => {
    for (const kind of ['code', 'omni-loop', 'flake', 'person'] as const) expect(refuses(retro({ class: kind })), kind).toBe(false);
    expect(refuses({ ...retro(), class: 'infra' })).toBe(true);
    expect(refuses({ ...retro(), class: 'Code' })).toBe(true);
  });

  it('refuses an evidence line longer than one sentence, or a log excerpt', () => {
    expect(refuses(retro({ evidence: ['The test failed. Then the next one failed too.'] }))).toBe(true);
    expect(refuses(retro({ evidence: ['FAIL kit/lib/sum.test.ts\n  at sum (kit/lib/sum.ts:3:9)'] }))).toBe(true);
    expect(refuses(retro({ evidence: ['x'.repeat(241)] }))).toBe(true);
    expect(refuses(retro({ cause: 'It broke. Nobody knows why.' }))).toBe(true);
  });

  it('refuses a fingerprint that is not one', () => {
    expect(refuses(retro({ fingerprint: 'abc' }))).toBe(true);
    expect(refuses(retro({ fingerprint: 'A'.repeat(64) }))).toBe(true);
  });

  it('refuses a retro that holds a credential in clear', () => {
    const token = 'ghp_' + 'a'.repeat(36);
    expect(refuses(retro({ signature: `401 with ${token}` }))).toBe(true);
    expect(refuses(retro({ evidence: [`The key ${['Zx9Q', 'w2Lm', '4Np6', 'Rt8V', 'b0Cd', '3Fg5'].join('')} was refused.`] }))).toBe(true);
  });
});

describe('isOneSentence', () => {
  it('reads one sentence, a dot inside a word or a number included', () => {
    expect(isOneSentence('The sum in kit/lib/sum.ts returns 2.5 for e.g. two halves.')).toBe(true);
    expect(isOneSentence('The test failed. It failed again.')).toBe(false);
    expect(isOneSentence('Two lines\nof text')).toBe(false);
    expect(isOneSentence('')).toBe(false);
  });
});
