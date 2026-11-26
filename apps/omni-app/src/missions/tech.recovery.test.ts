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

// Bug #3334: the Architect answered the open points itself, pushed version 3c8850f and approved it, after the PM's two real rounds
// (its first approval, then its answer to the open points). The PM's confirmation of that version is the closing step, not a new
// round: the PRD waited on a person instead (mission #3319, omni-loop-28).
const C38 = `3c8850f${'c'.repeat(57)}`;

/** Omni-loop-28's whole history in mission #3319: the PM's answering round, then the Architect's approval of the version it pushed. */
const CLOSING: readonly PlanDecision[] = [...HISTORY, decision('plan', 'plan-3', F75, 'approved'), decision('tech', 'tech-4', C38, 'approved')];
const closing = (over: Partial<ReviewView> = {}): ReviewView => view({ latest: C38, plans: [plan(1), plan(2), plan(3)], techs: [tech(1, failed), tech(2, failed), tech(3), tech(4)], decisions: CLOSING, ...over });

describe('the PM confirming a version the Architect pushed and approved, once its rounds are spent (bug #3334)', () => {
  it("sends the PM's plan job to approve 3c8850f, not a person", () => {
    expect(reviewStateOf(closing())).toEqual({ state: 'plan', again: true });
  });

  it('builds once the PM approved 3c8850f: both decisions name the latest version', () => {
    const confirmed = [...CLOSING, decision('plan', 'plan-4', C38, 'approved')];
    expect(reviewStateOf(closing({ plans: [plan(1), plan(2), plan(3), plan(4)], decisions: confirmed }))).toEqual({ state: 'build' });
  });

  it('goes to a person once the PM, sent to confirm it, approved another version instead: the confirmation is sent once', () => {
    const other = [...CLOSING, decision('plan', 'plan-4', V2, 'approved')];
    expect(reviewStateOf(closing({ latest: V2, plans: [plan(1), plan(2), plan(3), plan(4)], decisions: other }))).toMatchObject({ state: 'waits' });
  });

  it('goes to a person once the PM, sent to confirm it, escalated', () => {
    const escalated = [...CLOSING, decision('plan', 'plan-4', C38, 'escalated', ['the PM does not agree with 3c8850f'])];
    expect(reviewStateOf(closing({ plans: [plan(1), plan(2), plan(3), plan(4)], decisions: escalated }))).toMatchObject({ state: 'waits' });
  });
});

// Bug #3343: the PM's plan job sent again because the Architect's reviews left no record (bug #3326) pushed a new plan version, 25c9323,
// while at it. Bug #3332 skipped only a recovery that kept the version, so this one counted as a round: when the Architect then escalated
// with real open points, the rounds read spent and the PRD waited on a person (mission #3319, omni-loop-32).
const P32 = parseProductPrdId('omni-loop-32');
const V544 = `544d69e${'d'.repeat(57)}`;
const V25C = `25c9323${'e'.repeat(57)}`;
const V641 = `641c9db${'f'.repeat(57)}`;
const at32 = (one: PlanDecision): PlanDecision => ({ ...one, prd: P32 });
const POINTS32 = [
  'PM: the sidebar\'s Settings entry already opens /app/settings; confirm the trail lands there',
  'PM: the spec\'s Scope lists packages/design, but the trail cannot live there',
];

/** Omni-loop-32's history in mission #3319, up to the Architect's first real escalation. */
const HISTORY32: readonly PlanDecision[] = [
  decision('plan', 'plan-1', V544, 'approved'),
  decision('tech', 'tech-1', null, 'escalated', ['no record of the tech review']),
  decision('tech', 'tech-2', null, 'escalated', ['no record of the tech review']),
  decision('plan', 'plan-2', V25C, 'approved'),
  decision('tech', 'tech-3', V641, 'escalated', POINTS32),
].map(at32);
const plan32 = (k: number) => ({ ...plan(k), line: '/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-32', prd: P32 });
const tech32 = (k: number, attempt = done) => ({ ...tech(k, attempt), prd: P32 });
const view32 = (over: Partial<ReviewView> = {}): ReviewView => ({
  prd: P32, latest: V641, approval: 'none', plans: [plan32(1), plan32(2)], techs: [tech32(1, failed), tech32(2, failed), tech32(3)], decisions: HISTORY32, ...over,
});

describe('the PM recovery round that pushed a new version after the Architect left no record (bug #3343)', () => {
  it("sends the PM's plan job with the Architect's open points, not a person", () => {
    expect(reviewStateOf(view32())).toEqual({ state: 'plan', again: true, points: POINTS32 });
  });

  it('still goes to a person once the PM answered and the Architect escalates again: the real rounds are two', () => {
    const V3 = 'a1'.repeat(32);
    const answered = [...HISTORY32, at32(decision('plan', 'plan-3', V3, 'approved')), at32(decision('tech', 'tech-4', V3, 'escalated', ['still open']))];
    expect(reviewStateOf(view32({ latest: V3, plans: [plan32(1), plan32(2), plan32(3)], decisions: answered }))).toMatchObject({ state: 'waits' });
  });

  it("goes to a person once the Architect's reviews leave no record again after a recovery: every plan decision caps the recovery", () => {
    const again = [...HISTORY32.slice(0, 4), at32(decision('tech', 'tech-3', null, 'escalated', ['no record of the tech review'])), at32(decision('tech', 'tech-4', null, 'escalated', ['no record of the tech review']))];
    expect(reviewStateOf(view32({ latest: V25C, techs: [tech32(1, failed), tech32(2, failed), tech32(3, failed), tech32(4, failed)], decisions: again }))).toMatchObject({ state: 'waits' });
  });

  it("counts a new version that follows the Architect's one no-record review as a round: only a spent run of failures sends the recovery", () => {
    const once = [decision('plan', 'plan-1', V544, 'approved'), decision('tech', 'tech-1', null, 'escalated', ['no record of the tech review']), decision('plan', 'plan-2', V25C, 'approved'), decision('tech', 'tech-2', V641, 'escalated', POINTS32)].map(at32);
    expect(reviewStateOf(view32({ techs: [tech32(1, failed), tech32(2)], decisions: once }))).toMatchObject({ state: 'waits' });
  });
});
