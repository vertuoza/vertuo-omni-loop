// The PM plans and replans (PRD omni-loop-21 s9): the overlay's edges the job's tests do not reach, pure, with no store.
import { describe, expect, it } from 'vitest';
import { parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Committee } from './committee.ts';
import { nextPlanRound, planJobsOf, plannedOf, planEvents, withPlans, type PlanAt, type PlanJob } from './pm.plan.ts';
import { NO_REPAIRS, type RepairRow } from './repair.ts';
import type { Attempt, PrdFacts, PrdState, RecordedEvent, Run } from './supervisor.ts';

const p = (n: number): PrdNumber => parsePrd(n);
const attempt = (id: string, status: Attempt['status']): Attempt => ({ id, status, outcome: null, reason: null, prUrl: null });
const fact = (over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(1), approval: 'standing', stage: 'open', blockers: [], territory: ['apps/a/'], ...over });
const replan = (status: Attempt['status'], round = 2): PlanJob => ({ round, job: 'pm-2', line: '/omni:plan 1 --replan', attempt: attempt('pm-2', status), prd: p(1), kind: 'replan' });
const failedRun: Run = { prd: p(1), run: 4, step: 'build', job: 'b4', attempts: [attempt('b4', 'failed')] };
const stopped = new Map<PrdNumber, PrdState>([[p(1), { state: 'stopped', why: 'its job failed, and the mission spent its 9 repairs' }]]);
const row = (n: number): RepairRow => ({ id: `r${String(n)}`, prd: p(2), fingerprint: 'f'.repeat(64), round: 1, number: 1, failedJob: `x${String(n)}`, job: `j${String(n)}`, retro: null, fixPr: null, outcome: 'not fixed' });
const spent = { ...NO_REPAIRS, budget: 9, rows: Array.from({ length: 9 }, (_, n) => row(n)) };
const at = (over: Partial<PlanAt> = {}): PlanAt => ({ alone: true, facts: [fact()], runs: [failedRun], committees: [], plans: [], recorded: [], repairs: spent, ...over });

describe('the plan jobs', () => {
  it('reads a repository PRD\'s plan jobs from the PM\'s jobs, never its own PRDs\' job nor a product PRD\'s', () => {
    const jobs = [
      { round: 1, job: 'pm-1', line: '/omni:roadmap --mission 12 --cap 2', attempt: attempt('pm-1', 'done') },
      { round: 2, job: 'pm-2', line: '/omni:plan 7', attempt: attempt('pm-2', 'done') },
      { round: 3, job: 'pm-3', line: '/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-15', attempt: attempt('pm-3', 'queued') },
      { round: 4, job: 'pm-4', line: '/omni:plan 8 --replan', attempt: attempt('pm-4', 'failed') },
    ];
    const plans = planJobsOf(jobs);
    expect(plans.map(({ prd, kind }) => [prd, kind])).toEqual([[p(7), 'plan'], [p(8), 'replan']]);
    expect([...plannedOf(plans)]).toEqual([p(7)]);
    expect(nextPlanRound(jobs)).toBe(5);
    expect(nextPlanRound([])).toBe(2);
  });

  it('records a plan job\'s end once, signed pm, and nothing while it works', () => {
    const one = replan('failed');
    expect(planEvents(replan('running'), [])).toEqual([]);
    expect(planEvents(one, [])).toEqual([{ kind: 'job-ended', role: 'pm', prd: p(1), job: 'pm-2', link: null, sentence: 'The PM\'s replan of PRD 1 failed.' }]);
    expect(planEvents(one, [{ kind: 'job-ended', prd: p(1), job: 'pm-2' }])).toEqual([]);
  });
});

describe('the replan', () => {
  it('is sent when the mission spent its 9 repairs, and never with repairs off or below alone', () => {
    expect(withPlans(stopped, at()).send).toEqual([{ prd: p(1), kind: 'replan' }]);
    expect(withPlans(stopped, at()).states.get(p(1))).toEqual({ state: 'deciding', round: 1 });
    expect(withPlans(stopped, at({ repairs: NO_REPAIRS })).send).toEqual([]);
    expect(withPlans(stopped, at({ alone: false })).states.get(p(1))).toEqual(stopped.get(p(1)));
    expect(withPlans(stopped, at({ repairs: { ...spent, rows: spent.rows.slice(1) } })).send).toEqual([]);
  });

  it('asks its committee under the PRD\'s next round, counting only the committees sent after it ended', () => {
    const before: Committee = { prd: p(1), round: 2, job: 'c2', attempt: attempt('c2', 'done'), decision: { outcome: 'carried', why: [] } };
    const recorded: RecordedEvent[] = [
      { kind: 'dispatched', prd: p(1), job: 'b4' },
      { kind: 'dispatched', prd: p(1), job: 'c2' },
      { kind: 'job-ended', prd: p(1), job: 'pm-2' },
    ];
    const planned = withPlans(stopped, at({ plans: [replan('done')], committees: [before], recorded }));
    expect(planned.states.get(p(1))).toEqual({ state: 'approvable', round: 3 });
    expect(planned.send).toEqual([]);
  });

  it('waits on its end being recorded, and lets go of the PRD once it was built again', () => {
    expect(withPlans(stopped, at({ plans: [replan('done')] })).states.get(p(1))).toEqual({ state: 'deciding', round: 1 });
    const rebuilt: Run = { prd: p(1), run: 5, step: 'build', job: 'b5', attempts: [attempt('b5', 'failed')] };
    const recorded: RecordedEvent[] = [{ kind: 'dispatched', prd: p(1), job: 'b4' }, { kind: 'job-ended', prd: p(1), job: 'pm-2' }, { kind: 'dispatched', prd: p(1), job: 'b5' }];
    const planned = withPlans(stopped, at({ plans: [replan('done')], runs: [failedRun, rebuilt], recorded }));
    expect(planned.states.get(p(1))).toEqual(stopped.get(p(1)));
    expect(planned.send).toEqual([]);
  });

  it('holds nothing once a person took the PRD on by hand', () => {
    const ready = new Map<PrdNumber, PrdState>([[p(1), { state: 'waits', on: 'merge' }]]);
    expect(withPlans(ready, at({ plans: [replan('done')] })).states.get(p(1))).toEqual({ state: 'waits', on: 'merge' });
  });
});
