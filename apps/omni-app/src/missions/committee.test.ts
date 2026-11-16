import { describe, expect, it } from 'vitest';
import { committeeLine } from 'omni-loop/kit/lib/committee/record.ts';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { approvalNext, approveLine, committeeKey, committeeOfKey, recordedOf, type Committee } from './committee.ts';
import type { Attempt } from './supervisor.ts';

// The fleet's committee in a mission's run (PRD 2896 s9), pure: when a PRD goes to its committee, and what the App records
// from a committee job's log, deciding again rather than taking the job's word.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const prd = parsePrd(7);
const attempt = (status: Attempt['status']): Attempt => ({ id: 'c-1', status, outcome: null, reason: null, prUrl: null });
const committee = (round: number, status: Attempt['status'], decision: Committee['decision'] = null): Committee => ({ prd, round, job: `c-${String(round)}`, attempt: attempt(status), decision });
const read = [{ kind: 'spec', sha256: 'a'.repeat(64) }];
const yes = [
  { role: 'pm' as const, answer: 'yes' as const, sentence: 'In scope.' },
  { role: 'architect' as const, answer: 'yes' as const, sentence: 'Reversible.' },
  { role: 'reviewer' as const, answer: 'yes' as const, sentence: 'Tested.' },
];
const line = (over: Record<string, unknown> = {}) =>
  committeeLine({ v: 1, prd, kind: 'approve', author: null, read, escalations: [], verdicts: yes, outcome: 'carried', ...over });

describe('the committee\'s key and line', () => {
  it('is sent under its round\'s key, and read back from it', () => {
    expect(committeeKey(ID, prd, 2)).toBe(`mission:${ID}:prd:7:approve:2`);
    expect(committeeOfKey(committeeKey(ID, prd, 2))).toEqual({ prd: 7, round: 2 });
    expect(committeeOfKey(`mission:${ID}:prd:7:run:1`)).toBeNull();
    expect(approveLine(prd)).toBe('/omni:committee 7 --approve');
  });
});

describe('where a PRD\'s approval stands', () => {
  it('stands when approved, at any level', () => {
    expect(approvalNext('standing', [], true)).toEqual({ next: 'standing' });
    expect(approvalNext('standing', [], false)).toEqual({ next: 'standing' });
  });

  it('waits for a person once one overturned the fleet\'s approval, and never sends its committee again (PRD 2896 s11)', () => {
    expect(approvalNext('overturned', [], true)).toEqual({ next: 'person', why: 'you overturned the fleet\'s approval' });
    expect(approvalNext('overturned', [committee(1, 'done', { outcome: 'carried', why: [] })], true)).toMatchObject({ next: 'person' });
    expect(approvalNext('overturned', [], false)).toEqual({ next: 'person', why: null });
  });

  it('waits for a person below alone, as before this PRD', () => {
    expect(approvalNext('none', [], false)).toEqual({ next: 'person', why: null });
    expect(approvalNext('voided', [committee(1, 'done', { outcome: 'carried', why: [] })], false)).toEqual({ next: 'person', why: null });
  });

  it('goes to its committee at alone, round 1, then waits while it decides', () => {
    expect(approvalNext('none', [], true)).toEqual({ next: 'send', round: 1 });
    expect(approvalNext('none', [committee(1, 'running')], true)).toEqual({ next: 'deciding', round: 1 });
    expect(approvalNext('none', [committee(1, 'done')], true)).toEqual({ next: 'deciding', round: 1 });
  });

  it('waits for a person once the committee sent it to one, why attached', () => {
    expect(approvalNext('none', [committee(1, 'done', { outcome: 'escalated', why: ['the Reviewer answered no: Out of scope.'] })], true)).toEqual({
      next: 'person',
      why: 'the committee sent it to you: the Reviewer answered no: Out of scope.',
    });
  });

  it('goes to its committee again when a push voided the fleet\'s approval, three times at most', () => {
    const carried = { outcome: 'carried' as const, why: [] };
    expect(approvalNext('voided', [committee(1, 'done', carried)], true)).toEqual({ next: 'send', round: 2 });
    expect(approvalNext('voided', [committee(2, 'done', carried), committee(1, 'done', carried)], true)).toEqual({ next: 'send', round: 3 });
    expect(approvalNext('voided', [committee(3, 'done', carried)], true)).toEqual({ next: 'person', why: 'the fleet\'s approval was voided 3 times' });
  });
});

describe('what the App records of a committee job', () => {
  it('carries three yes from the record, its files read by hash', () => {
    expect(recordedOf(prd, committee(1, 'done'), `12:00:00 Done: ok\n${line()}`)).toEqual({ record: { author: null, read, verdicts: yes }, decision: { outcome: 'carried', why: [] } });
  });

  it('decides again from the verdicts, never from the job\'s word on the outcome', () => {
    const verdicts = [yes[0], { role: 'architect', answer: 'unsure', sentence: 'No test named.' }, yes[2]];
    expect(recordedOf(prd, committee(1, 'done'), line({ verdicts, outcome: 'carried' })).decision).toEqual({ outcome: 'escalated', why: ['the Architect answered unsure: No test named.'] });
  });

  it('escalates on the list\'s reasons, whatever the members said', () => {
    expect(recordedOf(prd, committee(1, 'done'), line({ escalations: ['it bears on the Legal entry L-GDPR-4'] })).decision).toEqual({ outcome: 'escalated', why: ['it bears on the Legal entry L-GDPR-4'] });
  });

  it('lets the author sit out: two yes carry', () => {
    expect(recordedOf(prd, committee(1, 'done'), line({ author: 'pm', verdicts: yes.slice(1) })).decision.outcome).toBe('carried');
  });

  it('escalates a job that failed, or left no record, each member counted failed', () => {
    const failed = recordedOf(prd, committee(1, 'failed'), null);
    expect(failed.decision.outcome).toBe('escalated');
    expect(failed.record.verdicts.map((v) => v.answer)).toEqual(['failed', 'failed', 'failed']);
    expect(failed.decision.why[0]).toBe('the PM failed, counted unsure: Its job failed.');
    expect(recordedOf(prd, committee(1, 'done'), 'no record here').decision.why[0]).toBe('the PM failed, counted unsure: Its job ended with no record of the vote.');
    expect(recordedOf(prd, committee(1, 'cancelled'), null).decision.why[0]).toBe('the PM failed, counted unsure: Its job was cancelled.');
  });
});
