// Bug #3332: the PM's plan job sent again only because the Architect's reviews left no record (bug #3326) re-approved the same plan
// version, yet it was counted as one of the PM's two rounds. When the Architect then escalated with real open points for the PM, the
// rounds read spent and the PRD waited on a person instead of going back to the PM (bug #3286). Seen on mission #3319's omni-loop-28.
import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { reviewStateOf, type PlanDecision, type ReviewView } from './tech.ts';
import type { Attempt } from './supervisor.ts';

const P28 = parseProductPrdId('omni-loop-28');
const F75 = `f75dbf0${'a'.repeat(57)}`;
const V2 = 'b'.repeat(64);
const done: Attempt = { id: 'j', status: 'done', outcome: 'ready', reason: null, prUrl: null };
const failed: Attempt = { ...done, status: 'failed', outcome: null, reason: 'the job ended with no record' };
const plan = (k: number) => ({ round: k, job: `plan-${String(k)}`, line: '/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-28', attempt: done, prd: P28 });
const tech = (k: number, attempt = done) => ({ prd: P28, k, job: `tech-${String(k)}`, attempt });
const decision = (kind: PlanDecision['kind'], job: string, version: string | null, outcome: PlanDecision['outcome'], why: string[] = []): PlanDecision => ({ kind, prd: P28, job, plan: version, outcome, why, settled: [] });
const POINTS = ['PM: spec Solution, Scope and AC-5 name @omni/design and packages/design, but the plan builds the parts in @omni/ui'];

/** Omni-loop-28's history in mission #3319, up to the Architect's first real escalation. */
const HISTORY: readonly PlanDecision[] = [
  decision('plan', 'plan-1', F75, 'approved'),
  decision('tech', 'tech-1', null, 'escalated', ['no record of the tech review']),
  decision('tech', 'tech-2', null, 'escalated', ['no record of the tech review']),
  decision('plan', 'plan-2', F75, 'approved'),
  decision('tech', 'tech-3', F75, 'escalated', POINTS),
];
const view = (over: Partial<ReviewView> = {}): ReviewView => ({
  prd: P28, latest: F75, approval: 'none', plans: [plan(1), plan(2)], techs: [tech(1, failed), tech(2, failed), tech(3)], decisions: HISTORY, ...over,
});

describe('the PM round that only re-approved the same version after the Architect left no record (bug #3332)', () => {
  it("sends the PM's plan job with the Architect's open points, not a person", () => {
    expect(reviewStateOf(view())).toEqual({ state: 'plan', again: true, points: POINTS });
  });

  it('still goes to a person once the PM answered and the Architect escalates again: the real rounds are two', () => {
    const answered = [...HISTORY, decision('plan', 'plan-3', V2, 'approved'), decision('tech', 'tech-4', V2, 'escalated', ['still open'])];
    expect(reviewStateOf(view({ latest: V2, plans: [plan(1), plan(2), plan(3)], decisions: answered }))).toMatchObject({ state: 'waits' });
  });

  it('counts a re-approval of the same version that answers open points as a round', () => {
    const same = [...HISTORY, decision('plan', 'plan-3', F75, 'approved'), decision('tech', 'tech-4', F75, 'escalated', ['still open'])];
    expect(reviewStateOf(view({ plans: [plan(1), plan(2), plan(3)], decisions: same }))).toMatchObject({ state: 'waits' });
  });
});
