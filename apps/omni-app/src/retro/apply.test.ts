import { parseIssue, parsePr } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { applyLine, outcomesOf, unsettledLessons } from './apply.ts';

const issue = (number: number) => ({ number: parseIssue(number), url: `https://github.com/acme/widgets/issues/${number}`, state: 'open' as const });

describe('applyLine — the line that settles a retro PR’s kept lessons (PRD 2338)', () => {
  it('names the skill and the retro PR', () => {
    expect(applyLine(parsePr(21))).toBe('/omni:retro-apply --retro 21');
  });
});

describe('unsettledLessons — the kept lessons no run gives an outcome', () => {
  it('is every kept lesson, by its finding, when no run records an outcome', () => {
    const runs = [{ issues: { 'slow-slice:s3': issue(30), 'repeated-red:e2e': issue(31) } }];
    expect(unsettledLessons(runs)).toEqual(['slow-slice:s3', 'repeated-red:e2e']);
  });

  it('leaves out a lesson an outcome settles, whichever run records it', () => {
    const runs = [
      { issues: { 'slow-slice:s3': issue(30), 'repeated-red:e2e': issue(31) }, outcomes: { 'slow-slice:s3': { became: 'playbook/testing#never' } } },
      { issues: { 'bug:40': issue(32) }, outcomes: { 'repeated-red:e2e': { staysHere: 'A rule already says it.' } } },
    ];
    expect(unsettledLessons(runs)).toEqual(['bug:40']);
  });

  it('is nothing when the retro kept no lesson, or a run keeps none', () => {
    expect(unsettledLessons([])).toEqual([]);
    expect(unsettledLessons([{}, { issues: {} }])).toEqual([]);
  });

  it('names a lesson two runs keep once', () => {
    expect(unsettledLessons([{ issues: { 'slow-slice:s3': issue(30) } }, { issues: { 'slow-slice:s3': issue(30) } }])).toEqual(['slow-slice:s3']);
  });
});

describe('outcomesOf — every outcome the runs record, by finding', () => {
  it('reads each run’s, a later run’s winning', () => {
    const runs = [
      { outcomes: { 'slow-slice:s3': { became: 'playbook/testing#never' }, 'bug:40': { staysHere: 'Not about how to work here.' } } },
      {},
      { outcomes: { 'slow-slice:s3': { staysHere: 'A rule already says it.' } } },
    ];
    expect(outcomesOf(runs)).toEqual({ 'slow-slice:s3': { staysHere: 'A rule already says it.' }, 'bug:40': { staysHere: 'Not about how to work here.' } });
  });
});
