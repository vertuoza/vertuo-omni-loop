import { describe, expect, it } from 'vitest';
import type { Standing } from './verdicts.repository';
import { standingAnswer } from './verdicts.service';

// What the terminal reads of a spec's business laws (bug #2696): the verdict kept, with each finding's law,
// statement, quote and the judge's why; `pending` while the latest spec has none yet; nothing where nothing
// is judged. It never judges. Every law is fictional.

const SHA = 'c'.repeat(40);
const BASE: Standing = { dossier: 'd-1', specVersion: 'v-2', lawHome: 'acme/plan', packSha: SHA, verdict: null };
const FINDING = {
  law: 'BL-QUOTES-1', statement: 'A quote has a total above zero.', why: 'An empty quote loses trust.', quote: 'a zero total',
  domain: 'quotes', file: 'k/domains/quotes/business-laws.md', owners: ['ana'],
};
const kept = (over: Partial<NonNullable<Standing['verdict']>>): Standing => ({
  ...BASE,
  verdict: { specVersion: 'v-2', lawHome: 'acme/plan', packSha: SHA, state: 'green', reason: '3 judged', laws: ['BL-QUOTES-1'], domains: [], findings: [], judgedAt: '2026-12-01T09:00:00Z', ...over },
});

describe('what the terminal reads of a spec\'s business laws', () => {
  it('is nothing for anyone but a member, with no law home or with no spec', () => {
    expect(standingAnswer(null)).toBeNull();
    expect(standingAnswer({ ...BASE, lawHome: null })).toBeNull();
    expect(standingAnswer({ ...BASE, specVersion: null })).toBeNull();
  });

  it('is pending while the latest spec has no verdict, and not judged while the law home has no pack', () => {
    expect(standingAnswer(BASE)).toEqual({ state: 'pending' });
    expect(standingAnswer({ ...BASE, packSha: null })).toEqual({ state: 'neutral', reason: 'the law home has no knowledge pack yet', findings: [] });
  });

  it('is the verdict kept: a red with each law, its statement, the quote and the judge\'s why', () => {
    expect(standingAnswer(kept({}))).toEqual({ state: 'green', reason: '3 judged', judgedAt: '2026-12-01T09:00:00Z', findings: [] });
    expect(standingAnswer(kept({ state: 'red', reason: '1 law broken', findings: [{ ...FINDING, broken: 'The design sends an empty quote.' }, FINDING] }))).toEqual({
      state: 'red', reason: '1 law broken', judgedAt: '2026-12-01T09:00:00Z',
      findings: [
        { law: 'BL-QUOTES-1', statement: 'A quote has a total above zero.', quote: 'a zero total', broken: 'The design sends an empty quote.' },
        { law: 'BL-QUOTES-1', statement: 'A quote has a total above zero.', quote: 'a zero total' },
      ],
    });
  });
});
