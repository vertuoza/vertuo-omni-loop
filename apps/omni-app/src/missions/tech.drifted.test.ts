// Bug #3326: mission #3319's PM pushed a new plan version of omni-loop-28 (its `## Repositories` table, bug #3304), which voided its
// approval, and the Architect's review refused the drifted PRD twice with no record. The fleet's two failed reviews in a row sent it
// to a person, and fixing the review alone would leave it there. The Architect's failures in a row count since the PM's latest plan
// decision, and once they are spent the PM is sent its plan job once more while its rounds last: it approves the latest version
// again and the Architect reviews it again. A failed job is never counted approved (BL-GATE-1), and the rounds still end on a person.
import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { reviewDispatched, reviewStateOf, type PlanDecision, type ReviewView } from './tech.ts';
import type { Attempt } from './supervisor.ts';

const P28 = parseProductPrdId('omni-loop-28');
const V = 'f75dbf0'.padEnd(64, 'a');
const LINE = `/omni:mega-brainstorm --product omni-loop --plan-only ${P28} --mission 3319`;
const done: Attempt = { id: 'j', status: 'done', outcome: 'ready', reason: null, prUrl: null };
const plan = (round: number) => ({ round, job: `pm-${String(round)}`, line: LINE, attempt: done, prd: P28 });
const tech = (k: number) => ({ prd: P28, k, job: `tech-${String(k)}`, attempt: done });
const approvedPlan = (job: string): PlanDecision => ({ kind: 'plan', prd: P28, job, plan: V, outcome: 'approved', why: [], settled: [] });
const noRecord = (k: number): PlanDecision => ({ kind: 'tech', prd: P28, job: `tech-${String(k)}`, plan: null, outcome: 'escalated', why: ['no record of the tech review'], settled: [] });

/** Mission #3319's omni-loop-28 on 2026-11-26: the PM approved version V, then two reviews ended with no record. */
const at3319 = (over: Partial<ReviewView> = {}): ReviewView => ({
  prd: P28,
  latest: V,
  approval: 'voided',
  plans: [plan(2)],
  techs: [tech(1), tech(2)],
  decisions: [approvedPlan('pm-2'), noRecord(1), noRecord(2)],
  ...over,
});

describe('a PM product PRD whose reviews refused it twice with no record (bug #3326, mission #3319)', () => {
  it('sends the PM its plan job once more, never a person, while its rounds last', () => {
    expect(reviewStateOf(at3319())).toMatchObject({ state: 'plan', again: true });
  });

  it('says why the PM is sent again', () => {
    const state = reviewStateOf(at3319());
    if (state.state !== 'plan') throw new Error(`expected the PM's plan job, got ${state.state}`);
    expect(reviewDispatched(P28, 'pm-3', LINE, state).sentence).toBe(
      `Sent the PM ${LINE} again: the Architect's last 2 reviews of PRD ${P28} left no record, so the PM approves its latest plan version again before the Architect reviews it again.`,
    );
  });

  it('sends the Architect again once the PM approved the latest version again', () => {
    const view = at3319({ plans: [plan(2), plan(3)], decisions: [approvedPlan('pm-2'), noRecord(1), noRecord(2), approvedPlan('pm-3')] });
    expect(reviewStateOf(view)).toEqual({ state: 'tech', k: 3 });
  });

  it('goes to a person once the reviews of the PM\'s last round failed too: the rounds still end', () => {
    const view = at3319({
      plans: [plan(2), plan(3)],
      techs: [tech(1), tech(2), tech(3), tech(4)],
      decisions: [approvedPlan('pm-2'), noRecord(1), noRecord(2), approvedPlan('pm-3'), noRecord(3), noRecord(4)],
    });
    expect(reviewStateOf(view)).toMatchObject({ state: 'waits' });
  });

  it('never builds it: no review approved the latest version (BL-GATE-1)', () => {
    expect(reviewStateOf(at3319()).state).not.toBe('build');
  });
});
