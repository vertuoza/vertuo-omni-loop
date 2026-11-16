import { describe, expect, it } from 'vitest';
import { parsePrd } from '../ids.ts';
import { decisionLists, decisionsOf, overturnSentence, overturnWords, parseRef, refOf, trustLine, type DecisionEvent } from './overturn.ts';

// What a decision of the fleet is called, how the mission's events say it, and the words that show it (PRD 2896 s11).

const approved = (prd: number, verdicts = 'pm yes, architect yes, reviewer yes'): DecisionEvent => ({ kind: 'decided', prd: parsePrd(prd), sentence: `The committee approved PRD ${String(prd)}: ${verdicts}.` });
const answered = (prd: number, item: string): DecisionEvent => ({
  kind: 'decided', prd: parsePrd(prd), sentence: `The committee answered ${item} of PRD ${String(prd)} with option A: pm yes, architect yes, reviewer yes.`, link: 'https://github.com/a/b/pull/9',
});
const overturned = (ref: string, actor = 'ada'): DecisionEvent => ({ kind: 'overturned', prd: parsePrd(Number(ref.split('/')[0])), sentence: `${actor} overturned fleet decision ${ref}: no.`, actor });

describe('a decision\'s name', () => {
  it('is a PRD\'s number for its approval and <prd>/<item> for an answer, and nothing else', () => {
    expect(parseRef('2901')).toEqual({ prd: 2901, item: null });
    expect(parseRef('2901/s2-01')).toEqual({ prd: 2901, item: 's2-01' });
    expect(refOf({ prd: parsePrd(7), item: 's1' })).toBe('7/s1');
    for (const bad of ['', '0', 'x', '7/', '7/S1', '7/s1/x', '-1']) expect(parseRef(bad)).toBeNull();
  });
});

describe('the decisions of a mission', () => {
  it('reads each carried decision with its verdicts, in order, and the person who overturned it', () => {
    const list = decisionsOf([approved(5), answered(5, 's1-01'), overturned('5/s1-01', 'ben'), { kind: 'escalated', prd: parsePrd(6), sentence: 'PRD 6 goes to a person: x' }]);
    expect(list.map(({ ref, verdicts, option, overturnedBy }) => ({ ref: refOf(ref), verdicts, option, overturnedBy }))).toEqual([
      { ref: '5', verdicts: 'pm yes, architect yes, reviewer yes', option: null, overturnedBy: null },
      { ref: '5/s1-01', verdicts: 'pm yes, architect yes, reviewer yes', option: 'A', overturnedBy: 'ben' },
    ]);
  });

  it('keeps the decision when it is overturned, and lets one made again stand on its own', () => {
    const list = decisionsOf([approved(5), overturned('5'), approved(5)]);
    expect(list.map((one) => one.overturnedBy)).toEqual(['ada', null]);
  });

  it('reads a decision recorded before verdicts were kept, and ignores an overturn that names none', () => {
    const old: DecisionEvent = { kind: 'decided', prd: parsePrd(5), sentence: 'The committee approved PRD 5: every member who sat answered yes.' };
    expect(decisionsOf([old, overturned('9')])).toMatchObject([{ verdicts: null, overturnedBy: null }]);
  });
});

describe('what a person sees', () => {
  it('counts decisions and overturns in the trust line', () => {
    expect(trustLine([])).toBe('0 decisions by the fleet · 0 overturned');
    expect(trustLine(decisionsOf([approved(5), answered(5, 'a-1'), overturned('5')]))).toBe('2 decisions by the fleet · 1 overturned');
  });

  it('opens the pull request with the two lists, each line with its verdicts and link', () => {
    const lines = decisionLists(decisionsOf([approved(5), answered(5, 's1-01'), overturned('5')]));
    expect(lines.join('\n')).toBe(
      [
        '**Approved by the fleet**',
        '',
        '- PRD 5: pm yes, architect yes, reviewer yes · overturned by ada. Overturn it with `omni mission overturn <mission> 5`',
        '',
        '**Answered by the fleet**',
        '',
        '- s1-01 of PRD 5, option A: pm yes, architect yes, reviewer yes ([link](https://github.com/a/b/pull/9)). Overturn it with `omni mission overturn <mission> 5/s1-01`',
        '',
      ].join('\n'),
    );
    expect(decisionLists([])).toEqual([]);
  });

  it('says what an overturn does', () => {
    const ref = { prd: parsePrd(5), item: null };
    expect(overturnWords({ ref, branch: 'mission/1-x', onBranch: true }).join('\n')).toContain('PRD 5 leaves mission/1-x');
    expect(overturnWords({ ref: { prd: parsePrd(5), item: 'a-1' }, branch: null, onBranch: false })).toEqual([
      expect.stringContaining('The decision stays as it was recorded') as string,
      'a-1 of PRD 5 is open again for you: answer it on the PRD\'s feature pull request.',
    ]);
    expect(overturnSentence('ada', ref, 'why')).toBe('ada overturned fleet decision 5: why');
  });
});
