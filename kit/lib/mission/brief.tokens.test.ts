// A mission's token budget in its brief (PRD 3040 s1): the mandate's optional `tokens`, a whole number from 1 to 10⁹. A brief
// without it parses as it did before, with no budget. Kept apart from brief.test.ts, whose tests stay as they were.
import { describe, expect, it } from 'vitest';
import { MAX_MISSION_TOKENS, parseBrief } from './brief.ts';

const record = (...mandate: string[]) => [
  '---',
  'mission: 2850',
  'title: Every quote can be paid online',
  'fleet: night-shift',
  'goal: Every quote can be paid online, for every customer.',
  'scope:',
  '  prds: [2803]',
  ...(mandate.length === 0 ? [] : ['mandate:', ...mandate.map((line) => `  ${line}`)]),
  '---',
  '',
].join('\n');

const mandateOf = (text: string) => {
  const parsed = parseBrief(text);
  return parsed.ok ? parsed.brief.mandate : parsed.errors;
};

describe("a mission's token budget, in its mandate (PRD 3040)", () => {
  it('reads tokens, a whole number from 1 to 10⁹', () => {
    expect(mandateOf(record('tokens: 2000000'))).toEqual({ parallel: 2, level: 'with-you', hardToRevert: 0.6, ownPrds: 0, resumes: 3, tokens: 2_000_000 });
    expect(mandateOf(record('tokens: 1'))).toMatchObject({ tokens: 1 });
    expect(MAX_MISSION_TOKENS).toBe(1_000_000_000);
    expect(mandateOf(record('tokens: 1000000000'))).toMatchObject({ tokens: 1_000_000_000 });
  });

  it('parses a brief without it as before: no tokens key, no budget', () => {
    expect(mandateOf(record())).toEqual({ parallel: 2, level: 'with-you', hardToRevert: 0.6, ownPrds: 0, resumes: 3 });
    expect(mandateOf(record('parallel: 3'))).toEqual({ parallel: 3, level: 'with-you', hardToRevert: 0.6, ownPrds: 0, resumes: 3 });
  });

  it('reads an empty tokens as no budget, leaving no key behind', () => {
    expect(mandateOf(record('tokens:'))).toEqual({ parallel: 2, level: 'with-you', hardToRevert: 0.6, ownPrds: 0, resumes: 3 });
    expect(mandateOf(record('tokens: null'))).not.toHaveProperty('tokens');
  });

  it('refuses 0, a negative number, a fraction, more than 10⁹ and text, by name', () => {
    expect(mandateOf(record('tokens: 0'))).toEqual(['mandate.tokens: is 1 to 1000000000.']);
    expect(mandateOf(record('tokens: -5'))).toEqual(['mandate.tokens: is 1 to 1000000000.']);
    expect(mandateOf(record('tokens: 1.5'))).toEqual(['mandate.tokens: must be a whole number.']);
    expect(mandateOf(record('tokens: 1000000001'))).toEqual(['mandate.tokens: is 1 to 1000000000.']);
    expect(mandateOf(record('tokens: lots'))).toEqual(['mandate.tokens: must be a number.']);
  });

  it('still refuses a mandate field it does not know', () => {
    expect(mandateOf(record('budget: 5'))).toEqual(['mandate: unexpected field budget.']);
  });
});
