// Bug #3281: a PM product PRD whose plan job or review failed, or ended with no record, went to a person at once, and resuming the
// mission changed nothing (mission #3270). A job that left no record decided nothing: the fleet sends it again within its two rounds,
// and a person gets it only once its rounds are spent, or when a job that ran decided to escalate. It is never counted approved
// (BL-GATE-1).
import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { reviewStateOf, type PlanDecision, type ReviewView } from './tech.ts';
import type { Attempt } from './supervisor.ts';

const P27 = parseProductPrdId('omni-loop-27');
const A = 'a'.repeat(64);
const done: Attempt = { id: 'j', status: 'done', outcome: 'ready', reason: null, prUrl: null };
const failed: Attempt = { ...done, status: 'failed', outcome: null, reason: 'GET /api/runners/next answered 500' };
const plan = (k: number, attempt = done) => ({ round: k + 1, job: `plan-${String(k)}`, line: '/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-27', attempt, prd: P27 });
const tech = (k: number, attempt = done) => ({ prd: P27, k, job: `tech-${String(k)}`, attempt });
const noRecord = (kind: PlanDecision['kind'], why: string[]): PlanDecision => ({ kind, prd: P27, job: `${kind}-none`, plan: null, outcome: 'escalated', why, settled: [] });
const approved = (kind: PlanDecision['kind']): PlanDecision => ({ kind, prd: P27, job: `${kind}-${A}`, plan: A, outcome: 'approved', why: [], settled: [] });
const view = (over: Partial<ReviewView> = {}): ReviewView => ({ prd: P27, latest: A, approval: 'none', plans: [], techs: [], decisions: [], ...over });

describe('a failed plan job or review of a PM product PRD (bug #3281)', () => {
  it('sends the Architect again when its review failed with no record, never a person', () => {
    const at = view({ plans: [plan(1)], techs: [tech(1, failed)], decisions: [approved('plan'), noRecord('tech', ['no record of the tech review', 'its job failed'])] });
    expect(reviewStateOf(at)).toEqual({ state: 'tech', k: 2 });
  });

  it('sends the PM again when its plan job left no record of the plan approval, never a person', () => {
    const at = view({ plans: [plan(1)], decisions: [noRecord('plan', ['no record of the plan approval'])] });
    expect(reviewStateOf(at)).toMatchObject({ state: 'plan' });
  });

  it('goes to a person once the rounds are spent, and never counts a failed job approved', () => {
    // Bug #3326: two reviews with no record send the PM once more while its rounds last; the PM's second approval spends them.
    const none = noRecord('tech', ['no record of the tech review']);
    const again: PlanDecision = { ...approved('plan'), job: 'plan-again' };
    const at = view({ plans: [plan(1), plan(2)], techs: [1, 2, 3, 4].map((k) => tech(k, failed)), decisions: [approved('plan'), none, none, again, none, none] });
    expect(reviewStateOf(at)).toMatchObject({ state: 'waits' });
  });
});
