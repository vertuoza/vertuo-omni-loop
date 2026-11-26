import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { MISSION_REPAIRS, NO_REPAIRS, type RepairRow, type RepairView } from './repair.ts';
import { productStateOf, type Attempt, type ProductFact, type ProductRun } from './supervisor.ts';

// Bug #3330: a product PRD's build its runner lost (status failed, reason `runner lost`, or the two other reasons of a lost job) is
// not a failure. `/omni:ultra-yolo` is no skill the database resumes on its own (PRD 2809), so the mission sends the build again as its
// next run, within the resume step's cap at `alone` (`mandate.resumes`) and once below it, instead of sending a repair. The shape of
// the mission that showed it: level alone, run 1 lost on its runner, a repair sent for it whose retro read `person`.

const P = parseProductPrdId('omni-loop-29');
const fact: ProductFact = { prd: P, approval: 'standing', blockers: [], targets: ['demo-org/widgets'] };
const on: RepairView = { ...NO_REPAIRS, budget: MISSION_REPAIRS };
const where = (resumes: number | null, repairs: RepairView = on) => ({ joined: new Set<never>(), done: new Set<never>(), branch: 'mission/12-faster-quotes', resumes, repairs });

const attempt = (over: Partial<Attempt>): Attempt => ({ id: 'job', status: 'done', outcome: null, reason: null, prUrl: null, ...over });
const build = (run: number, over: Partial<Attempt> = {}): ProductRun => ({ prd: P, run, job: `job-${String(run)}`, attempts: [attempt({ id: `job-${String(run)}`, ...over })] });
const lost = (run: number, reason = 'runner lost'): ProductRun => build(run, { status: 'failed', reason });

/** The repair the mission sent for the lost build, ended, its retro `person`: it could not read the lost job. */
const personRepair: RepairView = {
  ...on,
  jobs: [{ prd: P, k: 1, job: 'rj-1', failedJob: 'job-1', attempts: [attempt({ id: 'rj-1', status: 'done' })] }],
  rows: [
    {
      id: 'r-1',
      prd: P,
      fingerprint: 'a'.repeat(64),
      round: 1,
      number: 1,
      failedJob: 'job-1',
      job: 'rj-1',
      retro: { cause: 'The failed job could not be read on this runner.', class: 'person', place: '/omni:repair', signature: 'no log', evidence: ['The job log was not readable.'], proposedFix: 'Read the job by hand.', fingerprint: 'a'.repeat(64) },
      fixPr: null,
      outcome: 'stopped',
    } satisfies RepairRow,
  ],
};

describe('productStateOf, a build its runner lost (bug #3330)', () => {
  it('at alone, sends the build again as run 2, never a repair', () => {
    expect(productStateOf(fact, [lost(1)], where(3))).toEqual({ state: 'startable', run: 2 });
  });

  it('the mission that showed it: run 1 lost, its repair read person, the next wake sends run 2', () => {
    expect(productStateOf(fact, [lost(1)], where(3, personRepair))).toEqual({ state: 'startable', run: 2 });
  });

  it('reads the two other reasons of a lost job as lost too', () => {
    expect(productStateOf(fact, [lost(1, 'the worktree could not be made')], where(3))).toEqual({ state: 'startable', run: 2 });
    expect(productStateOf(fact, [lost(1, 'the tmux session could not be started')], where(3))).toEqual({ state: 'startable', run: 2 });
  });

  it('at alone, while the lost builds number at most mandate.resumes; past that, a repair', () => {
    expect(productStateOf(fact, [lost(1), lost(2), lost(3)], where(3))).toEqual({ state: 'startable', run: 4 });
    expect(productStateOf(fact, [lost(1), lost(2), lost(3), lost(4)], where(3))).toEqual({ state: 'repairable', k: 1, failedJob: 'job-4', why: 'its build\'s runner was lost 4 times' });
  });

  it('below alone, once; the second loss waits for a person with repairs off', () => {
    expect(productStateOf(fact, [lost(1)], where(null, NO_REPAIRS))).toEqual({ state: 'startable', run: 2 });
    expect(productStateOf(fact, [lost(1), lost(2)], where(null, NO_REPAIRS))).toMatchObject({ state: 'waits', why: expect.stringContaining('its build\'s runner was lost twice') as string });
  });

  it('a build that failed for any other reason still gets its repair', () => {
    expect(productStateOf(fact, [build(1, { status: 'failed', reason: 'exit 1' })], where(3))).toEqual({ state: 'repairable', k: 1, failedJob: 'job-1', why: 'its job failed: exit 1' });
  });
});
