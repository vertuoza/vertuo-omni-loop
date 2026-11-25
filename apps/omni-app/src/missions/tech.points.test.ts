// Bug #3286: on a PRD the mission's PM wrote, the Architect's open points went straight to a person, though they were the PM's to
// answer, and a failed job used up a round (mission #3270). An Architect escalation with open points sends the PM's plan job again,
// with those points; the rounds count the jobs that decided (a record naming a plan version), and a job that failed or left no record
// is sent again, at most twice in a row per kind. A person gets the PRD once the rounds are spent, when the PM escalates, or when the
// failures are spent, the waiting line naming the Architect's open points.
import { describe, expect, it } from 'vitest';
import { parseProductPrdId, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { reviewDispatched, reviewStateOf, type PlanDecision, type ReviewView } from './tech.ts';
import type { Attempt } from './supervisor.ts';

const P28 = parseProductPrdId('omni-loop-28');
const P29 = parseProductPrdId('omni-loop-29');
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const done: Attempt = { id: 'j', status: 'done', outcome: 'ready', reason: null, prUrl: null };
const failed: Attempt = { ...done, status: 'failed', outcome: null, reason: 'runner lost' };
const LINE = (prd: ProductPrdId) => `/omni:mega-brainstorm --product omni-loop --plan-only ${prd} --mission 3270`;
const plan = (prd: ProductPrdId, k: number, attempt = done) => ({ round: k + 1, job: `plan-${String(k)}`, line: LINE(prd), attempt, prd });
const tech = (prd: ProductPrdId, k: number, attempt = done) => ({ prd, k, job: `tech-${String(k)}`, attempt });
const noRecord = (prd: ProductPrdId, kind: PlanDecision['kind']): PlanDecision => ({ kind, prd, job: `${kind}-none`, plan: null, outcome: 'escalated', why: [`no record of the ${kind === 'plan' ? 'plan approval' : 'tech review'}`, 'its job failed'], settled: [] });
const approved = (prd: ProductPrdId, kind: PlanDecision['kind'], on = A): PlanDecision => ({ kind, prd, job: `${kind}-${on}`, plan: on, outcome: 'approved', why: [], settled: [] });
const escalated = (prd: ProductPrdId, open: string[], on = A): PlanDecision => ({ kind: 'tech', prd, job: `tech-${on}`, plan: on, outcome: 'escalated', why: open, settled: [] });

const PACKAGE = 'The spec\'s acceptance criterion says the parts are exported from @omni/design, which has no React; the PM must confirm the package or reword the criterion';
const S5 = 's5: SectionTabs and Sidebar already use next/link, which prefetches by default; the PM should confirm what s5 must achieve';
const BUDGET = 'Q3 load-time budget (roadmap) is not answered';

/** omni-loop-28 on mission #3270: a PM plan job that failed with no record, one that approved, then the Architect's escalation. */
const P28_HISTORY: ReviewView = {
  prd: P28,
  latest: A,
  approval: 'none',
  plans: [plan(P28, 1, failed), plan(P28, 2)],
  techs: [tech(P28, 1)],
  decisions: [noRecord(P28, 'plan'), approved(P28, 'plan'), escalated(P28, [PACKAGE])],
};

/** omni-loop-29 on mission #3270: the PM approved, an Architect job failed, the next one escalated with two open points. */
const P29_HISTORY: ReviewView = {
  prd: P29,
  latest: A,
  approval: 'none',
  plans: [plan(P29, 1)],
  techs: [tech(P29, 1, failed), tech(P29, 2)],
  decisions: [approved(P29, 'plan'), noRecord(P29, 'tech'), escalated(P29, [S5, BUDGET])],
};

describe('the Architect\'s open points go back to the PM (bug #3286, mission #3270)', () => {
  it('omni-loop-28: a failed plan job used no round, so the PM is sent again with the Architect\'s open point', () => {
    expect(reviewStateOf(P28_HISTORY)).toEqual({ state: 'plan', again: true, points: [PACKAGE] });
  });

  it('omni-loop-29: a failed review used no round, so the PM is sent again with both open points', () => {
    expect(reviewStateOf(P29_HISTORY)).toEqual({ state: 'plan', again: true, points: [S5, BUDGET] });
  });

  it('says why the PM is sent again', () => {
    const state = reviewStateOf(P29_HISTORY);
    if (state.state !== 'plan') throw new Error('expected a plan job');
    expect(reviewDispatched(P29, 'job-9', LINE(P29), state).sentence).toBe(`Sent the PM ${LINE(P29)} again: it answers the Architect's open points on PRD omni-loop-29.`);
  });

  it('once the PM answered with a new version, the Architect reviews it, its failed job not counted', () => {
    const answered = { ...P29_HISTORY, latest: B, plans: [plan(P29, 1), plan(P29, 2)], decisions: [...P29_HISTORY.decisions, approved(P29, 'plan', B)] };
    expect(reviewStateOf(answered)).toEqual({ state: 'tech', k: 3 });
  });

  it('a person gets it when the Architect still escalates after the PM answered, the waiting line naming its open points', () => {
    const again = {
      ...P29_HISTORY,
      latest: B,
      plans: [plan(P29, 1), plan(P29, 2)],
      techs: [...P29_HISTORY.techs, tech(P29, 3)],
      decisions: [...P29_HISTORY.decisions, approved(P29, 'plan', B), escalated(P29, [BUDGET], B)],
    };
    expect(reviewStateOf(again)).toEqual({ state: 'waits', why: `PRD omni-loop-29: the Architect left it to you: ${BUDGET}; approve it on its page` });
    expect(reviewStateOf({ ...again, approval: 'standing' })).toEqual({ state: 'build' });
  });

  it('the PM\'s answer that failed is sent again with the points, and twice in a row goes to a person naming the Architect\'s points', () => {
    const once = { ...P28_HISTORY, plans: [...P28_HISTORY.plans, plan(P28, 3, failed)], decisions: [...P28_HISTORY.decisions, noRecord(P28, 'plan')] };
    expect(reviewStateOf(once)).toEqual({ state: 'plan', again: true, points: [PACKAGE] });
    const twice = { ...once, plans: [...once.plans, plan(P28, 4, failed)], decisions: [...once.decisions, noRecord(P28, 'plan')] };
    expect(reviewStateOf(twice)).toEqual({ state: 'waits', why: `PRD omni-loop-28: the Architect left it to you: ${PACKAGE}; approve it on its page` });
  });

  it('the PM\'s own escalation goes to a person', () => {
    const pm: PlanDecision = { kind: 'plan', prd: P28, job: 'plan-esc', plan: B, outcome: 'escalated', why: ['the latest spec breaks a business law'], settled: [] };
    const at = { ...P28_HISTORY, latest: B, plans: [...P28_HISTORY.plans, plan(P28, 3)], decisions: [...P28_HISTORY.decisions, pm] };
    expect(reviewStateOf(at)).toEqual({ state: 'waits', why: 'PRD omni-loop-28: the PM\'s plan approval went to you: the latest spec breaks a business law; approve it on its page' });
  });
});

describe('the rounds count decisions, the failures their own cap (bug #3286)', () => {
  it('a failed review after a decided one is sent again, whatever the number of jobs', () => {
    const C = 'c'.repeat(64);
    const at: ReviewView = { prd: P29, latest: C, approval: 'none', plans: [plan(P29, 1), plan(P29, 2)], techs: [tech(P29, 1), tech(P29, 2, failed)], decisions: [approved(P29, 'plan'), approved(P29, 'tech', B), approved(P29, 'plan', C), noRecord(P29, 'tech')] };
    expect(reviewStateOf(at)).toEqual({ state: 'tech', k: 3 });
  });

  it('two failed plan jobs in a row go to a person, never approved', () => {
    const at: ReviewView = { prd: P28, latest: null, approval: 'none', plans: [plan(P28, 1, failed), plan(P28, 2, failed)], techs: [], decisions: [noRecord(P28, 'plan'), noRecord(P28, 'plan')] };
    expect(reviewStateOf(at)).toMatchObject({ state: 'waits' });
  });
});
