// PRD 1139, slice s3: the loop plan — every slice of every driven PRD in numbered steps.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd, parseWorkSliceId } from '../ids.ts';
import type { PrdNumber } from '../ids.ts';
import type { Roadmap, RoadmapRow } from '../roadmap/parse.ts';
import type { PrStanding } from '../roadmap/push.ts';
import type { Verdict } from './decide.ts';
import { followPlan } from './follow.ts';
import { crossOrders, planLoop } from './plan.ts';
import type { PlanSliceInput, PrdInput } from './plan.ts';
import { roadmapGates } from './roadmap.ts';

const slice = (id: string, territory: string[], wave: number | null, state: PlanSliceInput['state'] = 'runnable'): PlanSliceInput => ({
  id: parseWorkSliceId(id),
  territory,
  wave,
  state,
});
const prd = (n: number, slices: PlanSliceInput[] | null, over: Partial<PrdInput> = {}): PrdInput => ({ prd: parsePrd(n), blockedBy: [], slices, ended: null, ...over });

/** Each step as `<prd> <kind> <wave> [<slices>]`, in order. */
const shape = (plan: ReturnType<typeof planLoop>) => plan.steps.map((step) => `${step.step}: ${step.prd} ${step.kind}${step.wave === null ? '' : ` w${step.wave}`}${step.slices.length ? ` ${step.slices.join(',')}` : ''}`);

describe('planLoop', () => {
  it("keeps each PRD's waves in order, then a finish step", () => {
    const plan = planLoop({ prds: [prd(7, [slice('s2', ['b/'], 2), slice('s1', ['a/'], 1), slice('s3', ['c/'], 1)])], shipped: [] });
    expect(shape(plan)).toEqual(['1: 7 wave w1 s1,s3', '2: 7 wave w2 s2', '3: 7 finish']);
    expect(plan.version).toBe(1);
    expect(plan.reason).toBeNull();
    expect(plan.steps[1]?.after).toEqual([1]);
  });

  it('runs two PRDs whose slices share territory in series, and says why', () => {
    const plan = planLoop({
      prds: [prd(1030, [slice('s3', ['apps/galaxy/src/nav/'], 1)]), prd(1017, [slice('s2', ['apps/galaxy/src/nav/sidebar.ts', 'x/'], 1)])],
      shipped: [],
    });
    expect(shape(plan)).toEqual(['1: 1017 wave w1 s2', '2: 1017 finish', '3: 1030 wave w1 s3', '4: 1030 finish']);
    expect(plan.steps[2]?.after).toEqual([1]);
    expect(plan.steps[2]?.why).toEqual(['1030 s3 after 1017 s2: both touch apps/galaxy/src/nav/']);
    expect(crossOrders(plan)).toEqual(['step 3: 1030 s3 after 1017 s2: both touch apps/galaxy/src/nav/']);
    expect(plan.steps[1]?.beside).toEqual([3]);
  });

  it('marks PRDs that share nothing to run beside each other', () => {
    const plan = planLoop({ prds: [prd(8, [slice('s1', ['b/'], 1)]), prd(7, [slice('s1', ['a/'], 1)])], shipped: [] });
    expect(shape(plan)).toEqual(['1: 7 wave w1 s1', '2: 8 wave w1 s1', '3: 7 finish', '4: 8 finish']);
    expect(plan.steps[0]?.beside).toEqual([2]);
    expect(plan.steps[1]?.beside).toEqual([1]);
    expect(plan.steps[2]?.beside).toEqual([4]);
    expect(crossOrders(plan)).toEqual([]);
  });

  it('holds blocked-by between driven PRDs: the blocked one waits until the other ships', () => {
    const plan = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1)], { blockedBy: [parsePrd(9)] }), prd(9, [slice('s1', ['b/'], 1)])], shipped: [] });
    expect(shape(plan)).toEqual(['1: 9 wave w1 s1', '2: 9 finish', '3: 7 wave w1 s1', '4: 7 finish']);
    expect(plan.steps[2]?.after).toEqual([2]);
    expect(plan.steps[2]?.why).toEqual(['7 after 9: blocked by it until it ships']);
  });

  it('a blocker outside the loop that has not shipped is waited for; one that has shipped is not', () => {
    const waiting = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1)], { blockedBy: [parsePrd(5)] })], shipped: [] });
    expect(waiting.steps[0]?.waitsFor).toEqual([5]);
    expect(waiting.steps[0]?.why).toEqual(['7 waits for 5 to ship']);
    const free = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1)], { blockedBy: [parsePrd(5)] })], shipped: [parsePrd(5)] });
    expect(free.steps[0]?.waitsFor).toEqual([]);
  });

  it('a PRD with no plan yet is one plan step', () => {
    const plan = planLoop({ prds: [prd(7, null)], shipped: [] });
    expect(shape(plan)).toEqual(['1: 7 plan']);
  });

  it('a slice already merged orders nothing, and a PRD with a stuck slice gives way', () => {
    const merged = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1)]), prd(8, [slice('s1', ['a/'], 1, 'merged')])], shipped: [] });
    expect(crossOrders(merged)).toEqual([]);
    const stuck = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1, 'stuck')]), prd(8, [slice('s1', ['a/'], 1)])], shipped: [] });
    expect(shape(stuck)).toEqual(['1: 8 wave w1 s1', '2: 8 finish', '3: 7 wave w1 s1', '4: 7 finish']);
    expect(stuck.steps[2]?.why).toEqual(['7 s1 after 8 s1: both touch a/']);
  });

  it('a slice with no wave runs after the numbered waves', () => {
    const plan = planLoop({ prds: [prd(7, [slice('s9', ['z/'], null), slice('s1', ['a/'], 1)])], shipped: [] });
    expect(shape(plan)).toEqual(['1: 7 wave w1 s1', '2: 7 wave s9', '3: 7 finish']);
  });

  it('the same plans and boards give the same steps, whatever order they come in', () => {
    const a = prd(1030, [slice('s3', ['n/'], 1), slice('s4', ['m/'], 2)]);
    const b = prd(1017, [slice('s2', ['n/'], 1)]);
    const c = prd(1040, [slice('s1', ['m/'], 1)], { blockedBy: [parsePrd(1017)] });
    const one = planLoop({ prds: [a, b, c], shipped: [] });
    const two = planLoop({ prds: [c, b, a], shipped: [] });
    expect(two).toEqual(one);
  });

  // PRD 1162, slice s1: in a plan repository, ground is a path in one repository.
  const inRepo = (repo: string, id: string, territory: string[]): PlanSliceInput => ({ ...slice(id, territory, 1), repo });

  it('the same path in two repositories → beside', () => {
    const plan = planLoop({ prds: [prd(1201, [inRepo('crew', 's3', ['apps/crew-api/'])]), prd(1213, [inRepo('ai-domain', 's2', ['apps/crew-api/'])])], shipped: [] });
    expect(crossOrders(plan)).toEqual([]);
    expect(shape(plan)).toEqual(['1: 1201 wave w1 s3', '2: 1213 wave w1 s2', '3: 1201 finish', '4: 1213 finish']);
    expect(plan.steps[0]?.beside).toEqual([2]);
  });

  it('the same path in one repository → in series, the reason naming <repo>:<path>', () => {
    const plan = planLoop({ prds: [prd(1213, [inRepo('crew', 's2', ['apps/crew-api/x.ts'])]), prd(1201, [inRepo('crew', 's3', ['apps/crew-api/'])])], shipped: [] });
    expect(crossOrders(plan)).toEqual(['step 3: 1213 s2 after 1201 s3: both touch crew:apps/crew-api/']);
  });

  it('each step carries the repositories of its slices, in a plan repository only', () => {
    const plan = planLoop({ prds: [prd(1201, [inRepo('crew', 's1', ['a/']), inRepo('ai-domain', 's2', ['b/'])])], shipped: [] });
    expect(plan.steps.map((step) => step.repos)).toEqual([
      ['ai-domain', 'crew'],
      ['ai-domain', 'crew'],
    ]);
    expect(planLoop({ prds: [prd(7, null)], shipped: [] }).steps[0]).not.toHaveProperty('repos');
    expect(planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1)])], shipped: [] }).steps[0]).not.toHaveProperty('repos');
  });

  it('records what it saw, so a later tick can tell what changed', () => {
    const plan = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1, 'stuck'), slice('s2', ['b/'], 1)])], shipped: [] });
    expect(plan.seen).toEqual([{ prd: 7, slices: ['s1', 's2'], stuck: ['s1'], ended: null }]);
    expect(plan.prds).toEqual([7]);
  });
});

// PRD 1162, slice s7: a roadmap's blocked PRD starts once its blocker merged, and nothing else waits.
describe('planLoop under a roadmap', () => {
  const A = parsePrd(1201);
  const B = parsePrd(1213);
  const C = parsePrd(1220);
  const act = (n: PrdNumber): Verdict => ({ prd: n, verdict: 'act', skill: 'ultra-wave', why: 'wave 1 can take s1' });
  const done = (n: PrdNumber): Verdict => ({ prd: n, verdict: 'done', why: 'merged' });
  const park = (n: PrdNumber): Verdict => ({ prd: n, verdict: 'park', why: 'waits on a merger' });
  const pr = (repo: string, number: number, state: PrStanding['state']): PrStanding => ({
    repo, number: parsePr(number), url: `https://github.com/acme/${repo}/pull/${number}`, state, isDraft: false, createdAt: null, mergedAt: null, closedAt: null, questions: 0,
  });
  const row = (id: string, n: PrdNumber, blockedBy: string[] = []): RoadmapRow => ({ id, prd: n, title: `${id} title`, repos: ['crew'], blockedBy, why: blockedBy.length ? 'x' : null, wave: blockedBy.length ? 2 : 1 });
  const roadmap: Roadmap = {
    roadmap: parseIssue(1200), title: 'Crew', milestone: 'm', product: null, target: null, source: null, repos: true,
    prds: [row('P1', A), row('P2', B, ['P1']), row('P3', C)], questions: [],
  };
  const inCrew = (id: string, territory: string): PlanSliceInput => ({ ...slice(id, [territory], 1), repo: 'crew' });
  const plan = planLoop({
    prds: [prd(1201, [inCrew('s1', 'a/')]), prd(1213, [inCrew('s1', 'b/')], { blockedBy: [A] }), prd(1220, [inCrew('s1', 'c/')])],
    shipped: [],
  });
  /** A tick, P1's PRs as given: the plan PR and the crew PR, two expected. */
  const tick = (prs: PrStanding[], verdicts: Verdict[]) => followPlan(plan, {
    verdicts: new Map(verdicts.map((verdict) => [verdict.prd, verdict] as const)),
    merged: new Map(),
    shipped: new Set(),
    gates: roadmapGates({ roadmap, answers: new Map(), standings: new Map([['P1', { shipped: false, prs, expected: 2 }]]), live: new Map(), issueLink: null }),
  });
  const half = [pr('plans', 12, 'MERGED'), pr('crew', 40, 'OPEN')];

  it("its first step comes after the blocker's finish", () => {
    expect(plan.steps.find((step) => step.prd === B)?.why).toEqual(['1213 after 1201: blocked by it until it ships']);
  });

  it('in a plan repository, held until the plan PR and every target PR merged', () => {
    expect(tick(half, [done(A), act(B), done(C)])).toEqual({
      state: 'stop',
      waiting: [{ prd: 1213, verdict: 'park', why: 'waits on crew#40 (P1 P1 title): ready, waiting for your merge', link: 'https://github.com/acme/crew/pull/40' }],
    });
    expect(tick([pr('plans', 12, 'MERGED')], [done(A), act(B), done(C)])).toMatchObject({ state: 'stop' });
    expect(tick([pr('plans', 12, 'MERGED'), pr('crew', 40, 'MERGED')], [done(A), act(B), done(C)])).toMatchObject({ state: 'step', step: { prd: 1213 } });
  });

  it('other steps run meanwhile', () => {
    expect(tick(half, [park(A), act(B), act(C)])).toMatchObject({ state: 'step', step: { prd: 1220 }, verdict: { verdict: 'act' } });
  });
});
