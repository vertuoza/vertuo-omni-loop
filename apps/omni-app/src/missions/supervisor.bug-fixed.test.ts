// A PRD stopped on an Omni Loop bug, once the bug is fixed or will not be (PRD 3088 s5, spec section 6), pure: where the PRD goes
// given what a run read of its mission's repairs, the bug's state and the kit its repository pins, and what the room is told.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { RepairRetro } from 'omni-loop/kit/lib/repair/retro.ts';
import { MISSION_REPAIRS, NO_REPAIRS, untold, type BugFix, type RepairJob, type RepairRow, type RepairView } from './repair.ts';
import { conclude, eventsOf, pick, prdStates, recordedKeys, type Attempt, type Mission, type PrdFacts, type Run } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const p = (n: number): PrdNumber => parsePrd(n);
const FP = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const REPO = 'vertuoza/vertuo-omni-loop';

const mission = (over: Partial<Mission> = {}): Mission => ({ id: ID, fleet: 'night-shift', status: 'running', parallel: 2, waitingOn: null, level: 'own-branch', number: 12, title: 'Faster quotes', ...over });
const facts = (n: number): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`] });
const attempt = (id: string, over: Partial<Attempt> = {}): Attempt => ({ id, status: 'running', outcome: null, reason: null, prUrl: null, ...over });
const failed = (id: string) => attempt(id, { status: 'failed', reason: 'exit code 1' });
const run = (n: number, k: number, ...attempts: Attempt[]): Run => ({ prd: p(n), run: k, step: 'build', job: attempts[0]?.id ?? `job-${String(n)}-${String(k)}`, attempts });
const retro: RepairRetro = {
  cause: 'omni runner work crashed.',
  class: 'omni-loop',
  place: 'omni runner work',
  signature: 'TypeError: cannot read the plan',
  evidence: ['The runner stopped on its own command.'],
  proposedFix: 'Read the plan before the worktree is made.',
  fingerprint: FP,
};
const repairJob = (prd: number, failedJob: string, job: string): RepairJob => ({ prd: p(prd), k: 1, job, failedJob, attempts: [attempt(job, { status: 'done' })] });
const row = (over: Partial<RepairRow> = {}): RepairRow => ({ id: 'row-1', prd: p(1), fingerprint: FP, round: 1, number: 1, failedJob: 'a', job: 'r1', retro, fixPr: null, outcome: 'stopped', ...over });

/** PRD 1 failed, was repaired, and its repair met Omni Loop bug #3100, now at `fix`; its repository pins `kit`. */
const view = (fix: BugFix | undefined, over: Partial<RepairView> = {}): RepairView => ({
  ...NO_REPAIRS,
  budget: MISSION_REPAIRS,
  jobs: [repairJob(1, 'a', 'r1')],
  rows: [row()],
  reports: new Map([['r1', { state: 'filed', repo: REPO, issue: parseIssue(3100), ...(fix === undefined ? {} : { fix }) }]]),
  ...over,
});
const FIXED: BugFix = { state: 'fixed', version: '0.0.690' };
const failedRun = [run(1, 1, failed('a'))];
const stateOf = (repairs: RepairView, runs: Run[] = failedRun) => prdStates([facts(1)], runs, undefined, undefined, undefined, repairs).get(p(1));

describe('a PRD waiting on an Omni Loop bug that is fixed', () => {
  it('AC-6: is sent its step again once its repository runs the fix, spending no repair', () => {
    expect(stateOf(view(FIXED, { kit: '0.0.690' }))).toEqual({ state: 'startable', run: 2, step: 'build' });
    expect(stateOf(view(FIXED, { kit: '0.0.712' }))).toEqual({ state: 'startable', run: 2, step: 'build' });
    const states = prdStates([facts(1)], failedRun, undefined, undefined, undefined, view(FIXED, { kit: '0.0.690' }));
    expect(pick({ mission: mission(), facts: [facts(1)], states })).toEqual([{ prd: p(1), run: 2, step: 'build' }]);
  });

  it('AC-7: on an older or unreadable kit, waits for the kit to be updated, and sends nothing', () => {
    const why = 'Fixed in v0.0.690: update the kit to resume (omni update)';
    expect(stateOf(view(FIXED, { kit: '0.0.689' }))).toEqual({ state: 'waits', on: 'kit', why });
    expect(stateOf(view(FIXED, { kit: '0.0.69' }))).toEqual({ state: 'waits', on: 'kit', why });
    expect(stateOf(view(FIXED, { kit: null }))).toEqual({ state: 'waits', on: 'kit', why });
    expect(stateOf(view(FIXED))).toEqual({ state: 'waits', on: 'kit', why });
    const states = prdStates([facts(1)], failedRun, undefined, undefined, undefined, view(FIXED, { kit: '0.0.689' }));
    expect(pick({ mission: mission(), facts: [facts(1)], states })).toEqual([]);
    // It waits, so the mission keeps waking and resumes the PRD at the first wake that reads a kit new enough.
    expect(conclude({ mission: mission(), facts: [facts(1)], states, sent: 0, now: NOW })).toMatchObject({ status: 'waiting', waitingOn: `PRD 1: ${why}` });
  });

  it('a paused or stopped mission waits for its own Resume', () => {
    expect(stateOf(view(FIXED, { kit: '0.0.690', held: true }))).toEqual({ state: 'stopped', why: 'Omni Loop bug #3100 is fixed in v0.0.690: resume the mission to carry on' });
  });

  it('after a Resume opens a new round, still goes again only on a kit that runs the fix', () => {
    expect(stateOf(view(FIXED, { round: 2, kit: '0.0.689' }))).toMatchObject({ state: 'waits', on: 'kit' });
    expect(stateOf(view(FIXED, { round: 2, kit: '0.0.690' }))).toEqual({ state: 'startable', run: 2, step: 'build' });
  });
});

describe('a PRD waiting on an Omni Loop bug that is open, or will not be fixed', () => {
  it('stays stopped while the bug is open, and goes again in a new round, as before', () => {
    expect(stateOf(view(undefined))).toEqual({ state: 'stopped', why: 'Waits on Omni Loop bug #3100' });
    expect(stateOf(view({ state: 'open' }))).toEqual({ state: 'stopped', why: 'Waits on Omni Loop bug #3100' });
    expect(stateOf(view({ state: 'open' }, { round: 2 }))).toEqual({ state: 'startable', run: 2, step: 'build' });
  });

  it('AC-8: stays stopped when the bug is closed as not planned, in any round', () => {
    const why = "Omni Loop bug #3100 won't be fixed: take this PRD by hand";
    expect(stateOf(view({ state: 'wont-fix' }))).toEqual({ state: 'stopped', why });
    expect(stateOf(view({ state: 'wont-fix' }, { round: 2 }))).toEqual({ state: 'stopped', why });
  });
});

describe('the room is told once', () => {
  const eventsFor = (repairs: RepairView, runs: Run[] = failedRun, recorded = recordedKeys([])) => {
    const states = prdStates([facts(1)], runs, undefined, undefined, undefined, repairs);
    const next = conclude({ mission: mission(), facts: [facts(1)], states, sent: 0, now: NOW });
    return eventsOf({ mission: mission(), facts: [facts(1)], states, runs, next, toFleet: true, recorded, repairs }).filter((event) => event.kind === 'bug-fixed');
  };
  const link = 'https://github.com/vertuoza/vertuo-omni-loop/issues/3100';

  it('AC-6: says the bug is fixed in its version, linking the public issue', () => {
    expect(eventsFor(view(FIXED, { kit: '0.0.690' }), [run(1, 1, failed('a')), run(1, 2, attempt('b', { status: 'queued' }))])).toEqual([
      { kind: 'bug-fixed', role: 'supervisor', prd: p(1), job: 'r1', link, sentence: 'Omni Loop bug #3100 is fixed in v0.0.690.' },
      { kind: 'bug-fixed', role: 'supervisor', prd: p(1), job: 'b', link, sentence: 'PRD 1 resumed: the kit is at v0.0.690.' },
    ]);
  });

  it('AC-7: says to update the kit when the repository pins an older one', () => {
    expect(eventsFor(view(FIXED, { kit: '0.0.689' })).map((event) => event.sentence)).toEqual(['Omni Loop bug #3100 is fixed in v0.0.690. Fixed in v0.0.690: update the kit to resume (omni update).']);
    expect(eventsFor(view(FIXED, { held: true })).map((event) => event.sentence)).toEqual(['Omni Loop bug #3100 is fixed in v0.0.690.']);
  });

  it('AC-8: says the bug will not be fixed', () => {
    expect(eventsFor(view({ state: 'wont-fix' })).map((event) => event.sentence)).toEqual(["Omni Loop bug #3100 won't be fixed: take this PRD by hand."]);
  });

  it('says nothing while the bug is open, once per bug, and nothing again once recorded', () => {
    expect(eventsFor(view({ state: 'open' }))).toEqual([]);
    const filed = { state: 'filed', repo: REPO, issue: parseIssue(3100), fix: FIXED } as const;
    const reports = new Map([['r1', filed], ['r2', filed]]);
    const twice = view(FIXED, { kit: '0.0.689', jobs: [repairJob(1, 'a', 'r1'), repairJob(2, 'c', 'r2')], rows: [row(), row({ id: 'row-2', prd: p(2), failedJob: 'c', job: 'r2' })], reports });
    expect(eventsFor(twice).map((event) => event.job)).toEqual(['r1']);
    expect(eventsFor(view(FIXED, { kit: '0.0.689' }), failedRun, recordedKeys([{ kind: 'bug-fixed', prd: p(1), job: 'r1' }]))).toEqual([]);
  });
});

describe('the missions to tell (AC-8)', () => {
  it('names each mission holding a PRD on a bug it has no bug-fixed event of yet, once', () => {
    const rows = [
      { mission: 'm1', job: 'r1', fingerprint: FP },
      { mission: 'm1', job: 'r2', fingerprint: FP },
      { mission: 'm2', job: 'r3', fingerprint: FP },
      { mission: 'm2', job: 'r4', fingerprint: OTHER },
      { mission: 'm3', job: 'r5', fingerprint: OTHER },
    ];
    expect(untold(rows, new Set(['r2', 'r3']))).toEqual(['m2', 'm3']);
    expect(untold(rows, new Set(['r1', 'r3', 'r4', 'r5']))).toEqual([]);
  });
});
