import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { addedProductsOf, productPlansOf, reviewStateOf, techKey, techOfKey, type PlanDecision, type ReviewView } from './tech.ts';
import type { Attempt } from './supervisor.ts';

const P31 = parseProductPrdId('omni-loop-31');
const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e26';
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const done: Attempt = { id: 'j', status: 'done', outcome: 'ready', reason: null, prUrl: null };
const queued: Attempt = { ...done, status: 'queued', outcome: null };
const plan = (k: number, attempt = done) => ({ round: k + 1, job: `plan-${String(k)}`, line: '/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-31', attempt, prd: P31 });
const tech = (k: number, attempt = done) => ({ prd: P31, k, job: `tech-${String(k)}`, attempt });
const decided = (kind: PlanDecision['kind'], on: string | null, outcome: PlanDecision['outcome'] = 'approved', why: string[] = []): PlanDecision => ({ kind, prd: P31, job: `${kind}-${on ?? 'none'}`, plan: on, outcome, why, settled: [] });
const view = (over: Partial<ReviewView> = {}): ReviewView => ({ prd: P31, latest: A, approval: 'none', plans: [], techs: [], decisions: [], ...over });

describe('reviewStateOf', () => {
  it('plans first, then the Architect, then the build once both name the latest version', () => {
    expect(reviewStateOf(view({ latest: null }))).toEqual({ state: 'plan', again: false });
    expect(reviewStateOf(view({ plans: [plan(1, queued)] }))).toEqual({ state: 'working' });
    expect(reviewStateOf(view({ plans: [plan(1)], decisions: [decided('plan', A)] }))).toEqual({ state: 'tech', k: 1 });
    expect(reviewStateOf(view({ plans: [plan(1)], techs: [tech(1)], decisions: [decided('plan', A), decided('tech', A)] }))).toEqual({ state: 'build' });
  });

  it('AC-3: a tech approval on a newer version sends the PM again, never the build', () => {
    const at = view({ latest: B, plans: [plan(1)], techs: [tech(1)], decisions: [decided('plan', A), decided('tech', B)] });
    expect(reviewStateOf(at)).toEqual({ state: 'plan', again: true });
  });

  it('a plan approved on a version pushed after the review sends the Architect again, two rounds at most', () => {
    const at = view({ latest: B, plans: [plan(1), plan(2)], techs: [tech(1)], decisions: [decided('plan', A), decided('tech', A), decided('plan', B)] });
    expect(reviewStateOf(at)).toEqual({ state: 'tech', k: 2 });
    // Bug #3286: the rounds count the reviews that decided, so the second one is the one with a decision.
    const C = 'c'.repeat(64);
    expect(reviewStateOf({ ...at, latest: C, techs: [tech(1), tech(2)], decisions: [...at.decisions, decided('tech', C)] })).toMatchObject({ state: 'waits' });
  });

  // AC-4, changed by bug #3286 (the owner's decision): the Architect's open points go back to the PM first; a person gets the PRD once
  // the Architect still escalates the version the PM answered with.
  it('AC-4: an escalated review sends the PM its open points, then waits on a person until a person approves the PRD on its page', () => {
    const open = ['the plan cuts no slice for the migration'];
    const first = view({ plans: [plan(1)], techs: [tech(1)], decisions: [decided('plan', A), decided('tech', A, 'escalated', open)] });
    expect(reviewStateOf(first)).toEqual({ state: 'plan', again: true, points: open });
    const at = view({ latest: B, plans: [plan(1), plan(2)], techs: [tech(1), tech(2)], decisions: [...first.decisions, decided('plan', B), { ...decided('tech', B, 'escalated', open), job: 'tech-b2' }] });
    expect(reviewStateOf(at)).toEqual({ state: 'waits', why: 'PRD omni-loop-31: the Architect left it to you: the plan cuts no slice for the migration; approve it on its page' });
    expect(reviewStateOf({ ...at, approval: 'standing' })).toEqual({ state: 'build' });
  });
});

describe('the keys and the reads', () => {
  it('reads a tech key back, and nothing else', () => {
    expect(techOfKey(techKey(ID, P31, 2))).toEqual({ prd: P31, k: 2 });
    expect(techOfKey(`mission:${ID}:prd:31:tech:1`)).toBeNull();
    expect(techOfKey(`mission:${ID}:prd:omni-loop-31:run:1`)).toBeNull();
  });

  it('takes the plan jobs of product PRDs only, and the product PRDs the fleet added once each', () => {
    const jobs = [plan(1), { ...plan(2), line: '/omni:plan 7' }, { ...plan(3), line: '/omni:roadmap --mission 12 --cap 2 --product omni-loop' }];
    expect(productPlansOf(jobs).map(({ job }) => job)).toEqual(['plan-1']);
    expect(addedProductsOf([{ kind: 'prd-added', product: P31 }, { kind: 'prd-added', prd: P31 }, { kind: 'dispatched', product: P31 }])).toEqual([P31]);
  });
});
