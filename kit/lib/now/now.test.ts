// PRD #1208, slice s1: what a session is on, as `omni now` says it — the work of a PRD, its stage
// worded `building` while a slice is not merged, the slices in flight and stuck by id and name, the
// "doing" line, and the plain lines. Pure: no git, no disk.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd } from '../ids.ts';
import { NOTHING, nowOfFix, nowOfPrd, nowLines, workStage } from './now.ts';

const slice = (id: string, state: string, name?: string) => ({ id, wave: 1, state, ...(name ? { name } : {}) });
const BUILDING = [slice('s1', 'merged', 'base'), slice('s3', 'in-flight', 'tabs'), slice('s4', 'claimed-stale', 'board'), slice('s5', 'stuck'), slice('s6', 'blocked', 'later')];
const PRD = { number: parsePrd(315), topic: 'help-and-status', stage: 'outbox' as const };

describe('the stage of a PRD', () => {
  it('reads building while a slice of its board is not merged, and outbox once every one is', () => {
    expect(workStage('outbox', BUILDING)).toBe('building');
    expect(workStage('outbox', [slice('s1', 'merged'), slice('s2', 'merged')])).toBe('outbox');
  });

  it('reads as PRD 324 says without a board, with an empty one, and on every other stage', () => {
    expect(workStage('outbox', null)).toBe('outbox');
    expect(workStage('outbox', [])).toBe('outbox');
    for (const stage of ['inbox', 'in review', 'shipped'] as const) expect(workStage(stage, BUILDING)).toBe(stage);
    expect(workStage(null, BUILDING)).toBeNull();
  });
});

describe('the work of a PRD', () => {
  it('names the PRD, its stage, and the slices in flight and stuck, by id, name and state', () => {
    expect(nowOfPrd({ ...PRD, slices: BUILDING })).toEqual({
      headline: null,
      work: {
        kind: 'prd',
        number: 315,
        topic: 'help-and-status',
        stage: 'building',
        slices: [
          { id: 's3', name: 'tabs', state: 'in-flight' },
          { id: 's4', name: 'board', state: 'claimed-stale' },
          { id: 's5', name: null, state: 'stuck' },
        ],
        links: [],
      },
      doing: 'building s3 tabs, s4 board',
    });
  });

  it('does nothing with no slice in flight, and lists no slice without a board', () => {
    expect(nowOfPrd({ ...PRD, slices: [slice('s1', 'merged'), slice('s2', 'stuck', 'x')] })).toMatchObject({
      work: { stage: 'building', slices: [{ id: 's2', name: 'x', state: 'stuck' }] },
      doing: null,
    });
    expect(nowOfPrd({ ...PRD, stage: 'inbox', slices: null })).toMatchObject({ work: { stage: 'inbox', slices: [] }, doing: null });
  });

  it('names a slice by its id alone in the doing line when the board keeps no name', () => {
    expect(nowOfPrd({ ...PRD, slices: [slice('s2', 'in-flight'), slice('s3', 'in-flight', 'tabs')] }).doing).toBe('building s2, s3 tabs');
  });
});

describe('the plain lines', () => {
  it('print the work, then what it is doing and what is stuck', () => {
    expect(nowLines(nowOfPrd({ ...PRD, slices: BUILDING }))).toEqual(['PRD 315 help-and-status · building', 'building s3 tabs, s4 board · stuck s5']);
  });

  it('print one line when nothing is in flight or stuck, and the PRD alone with no stage', () => {
    expect(nowLines(nowOfPrd({ ...PRD, stage: 'shipped', slices: null }))).toEqual(['PRD 315 help-and-status · shipped']);
    expect(nowLines(nowOfPrd({ ...PRD, stage: null, slices: null }))).toEqual(['PRD 315 help-and-status']);
    expect(nowLines(nowOfPrd({ ...PRD, slices: [slice('s2', 'stuck', 'x')] }))).toEqual(['PRD 315 help-and-status · building', 'stuck s2 x']);
  });

  it('print the no-PRD line when the session is on nothing', () => {
    expect(NOTHING).toEqual({ headline: null, work: null, doing: null });
    expect(nowLines(NOTHING)).toEqual(['no PRD · /omni:brainstorm to start']);
  });
});

// PRD #1208, slice s2: a session on a bug fix or a visual fix.
describe('the work of a fix', () => {
  it('names the fix by its kind, number and topic, in progress until its folder is on the base', () => {
    for (const kind of ['bug', 'visual'] as const) {
      expect(nowOfFix({ kind, number: parseIssue(1180), topic: 'login-redirect', merged: false })).toEqual({
        headline: null,
        work: { kind, number: 1180, topic: 'login-redirect', stage: 'in progress', slices: [], links: [] },
        doing: null,
      });
      expect(nowOfFix({ kind, number: parseIssue(1180), topic: 'login-redirect', merged: true }).work).toMatchObject({ stage: 'merged' });
    }
  });

  it('prints one line: the kind, #number, topic and stage', () => {
    expect(nowLines(nowOfFix({ kind: 'bug', number: parseIssue(1180), topic: 'login-redirect', merged: false }))).toEqual(['bug #1180 login-redirect · in progress']);
    expect(nowLines(nowOfFix({ kind: 'visual', number: parseIssue(1150), topic: 'sidebar', merged: true }))).toEqual(['visual #1150 sidebar · merged']);
  });
});
