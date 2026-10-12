// PRD 1139, slice s3: following the frozen loop plan — the first step not done, never a later one
// that could run, save one the plan marked beside it. PRD 1162, slice s7: under a roadmap. PRD 1205,
// slice s1: the pool of steps a tick launches at once, each passing the collision check.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd, parseWorkSliceId } from '../ids.ts';
import type { PrdNumber, WorkSliceId } from '../ids.ts';
import type { Roadmap, RoadmapQuestion, RoadmapRow } from '../roadmap/parse.ts';
import type { PrdStanding, PrStanding } from '../roadmap/push.ts';
import type { PrdFacts, Verdict } from './decide.ts';
import { followPlan, followSteps } from './follow.ts';
import type { Live, Pool, Running } from './follow.ts';
import { planLoop } from './plan.ts';
import type { PlanSliceInput, PrdInput } from './plan.ts';
import { liveWords, roadmapGates } from './roadmap.ts';
import type { RoadmapRead } from './roadmap.ts';

const P7 = parsePrd(7);
const P8 = parsePrd(8);
const P9 = parsePrd(9);
const slice = (id: string, territory: string[], wave: number): PlanSliceInput => ({ id: parseWorkSliceId(id), territory, wave, state: 'runnable' });
const prd = (prd: PrdNumber, slices: PlanSliceInput[], over: Partial<PrdInput> = {}): PrdInput => ({ prd, blockedBy: [], slices, ended: null, ...over });

const act = (prd: PrdNumber): Verdict => ({ prd, verdict: 'act', skill: 'wave', why: 'wave can take' });
const wait = (prd: PrdNumber): Verdict => ({ prd, verdict: 'wait', why: 'claim held', wakeHint: 1200 });
const park = (prd: PrdNumber): Verdict => ({ prd, verdict: 'park', why: 'waits on @pm', link: 'https://x/pr/1' });
const done = (prd: PrdNumber): Verdict => ({ prd, verdict: 'done', why: 'merged' });

function live(verdicts: Verdict[], merged: Record<number, string[]> = {}, shipped: number[] = []): Live {
  return {
    verdicts: new Map(verdicts.map((verdict) => [verdict.prd, verdict])),
    merged: new Map(Object.entries(merged).map(([n, ids]) => [parsePrd(Number(n)), new Set<WorkSliceId>(ids.map(parseWorkSliceId))])),
    shipped: new Set(shipped.map(parsePrd)),
  };
}

// 7 and 8 collide on a/ (8 waits on 7); 9 shares nothing and runs beside 7.
const plan = planLoop({
  prds: [prd(P7, [slice('s1', ['a/'], 1), slice('s2', ['b/'], 2)]), prd(P8, [slice('s1', ['a/x'], 1)]), prd(P9, [slice('s1', ['z/'], 1)])],
  shipped: [],
});

describe('followPlan', () => {
  it('the plan reads as expected', () => {
    expect(plan.steps.map((step) => `${step.step}:${step.prd}:${step.kind}:${step.wave ?? '-'}:[${step.beside.join(',')}]`)).toEqual([
      '1:7:wave:1:[2]',
      '2:9:wave:1:[1]',
      '3:7:wave:2:[4,5]',
      '4:8:wave:1:[3,5]',
      '5:9:finish:-:[3,4]',
      '6:7:finish:-:[7]',
      '7:8:finish:-:[6]',
    ]);
  });

  it('returns the first step not done', () => {
    const followed = followPlan(plan, live([act(P7), act(P8), act(P9)]));
    expect(followed).toMatchObject({ state: 'step', step: { step: 1 }, verdict: { prd: 7, verdict: 'act' } });
  });

  it('never a later step that could run: 8 waits on 7 even though its own verdict is act', () => {
    const followed = followPlan(plan, live([act(P7), act(P8), done(P9)], { 7: ['s1'] }));
    expect(followed).toMatchObject({ state: 'step', step: { step: 3 }, verdict: { prd: 7 } });
  });

  it('when the first step waits, a step marked beside it that can act is taken instead', () => {
    const followed = followPlan(plan, live([wait(P7), act(P8), act(P9)]));
    expect(followed).toMatchObject({ state: 'step', step: { step: 2 }, verdict: { prd: 9, verdict: 'act' } });
  });

  it('when the first step waits and nothing beside it can act, the wait is the verdict', () => {
    const followed = followPlan(plan, live([wait(P7), act(P8), wait(P9)]));
    expect(followed).toMatchObject({ state: 'step', step: { step: 1 }, verdict: { prd: 7, verdict: 'wait' } });
  });

  it('a parked PRD is passed over, and the steps that wait on it are held', () => {
    const followed = followPlan(plan, live([park(P7), act(P8), act(P9)]));
    expect(followed).toMatchObject({ state: 'step', step: { step: 2 }, verdict: { prd: 9 } });
  });

  it('a PRD that is done counts every step of it done', () => {
    const followed = followPlan(plan, live([done(P7), act(P8), done(P9)]));
    expect(followed).toMatchObject({ state: 'step', step: { step: 4 }, verdict: { prd: 8 } });
  });

  it('stops once every PRD is parked or done, listing what each waits on', () => {
    const followed = followPlan(plan, live([park(P7), act(P8), done(P9)]));
    expect(followed).toEqual({
      state: 'stop',
      waiting: [park(P7), { prd: 8, verdict: 'park', why: 'waits on PRD 7: step 4 comes after step 1' }],
    });
  });

  it('a step waiting for a PRD outside the loop to ship is held until it has', () => {
    const blocked = planLoop({ prds: [prd(P7, [slice('s1', ['a/'], 1)], { blockedBy: [parsePrd(5)] })], shipped: [] });
    expect(followPlan(blocked, live([act(P7)]))).toEqual({ state: 'stop', waiting: [{ prd: 7, verdict: 'park', why: 'waits on PRD 5 to ship' }] });
    expect(followPlan(blocked, live([act(P7)], {}, [5]))).toMatchObject({ state: 'step', step: { step: 1 } });
  });

  it('every step done stops with nothing waiting', () => {
    expect(followPlan(plan, live([done(P7), done(P8), done(P9)]))).toEqual({ state: 'stop', waiting: [] });
  });
});

// PRD 1162, slice s7: under a roadmap, what each PRD is held or parked on, and the words it says so in.
describe('followPlan under a roadmap', () => {
  const A = parsePrd(1201);
  const B = parsePrd(1202);
  const C = parsePrd(1203);
  const ISSUE = 'https://github.com/acme/widgets/issues/1200';
  const PR_URL = 'https://github.com/acme/widgets/pull/31';
  const row = (id: string, n: PrdNumber, title: string, blockedBy: string[] = []): RoadmapRow => ({ id, prd: n, title, repos: null, blockedBy, why: blockedBy.length ? 'needs it' : null, wave: blockedBy.length ? 2 : 1 });
  const roadmap = (questions: RoadmapQuestion[] = []): Roadmap => ({
    roadmap: parseIssue(1200), title: 'Crew', milestone: 'A mandate', product: null, target: null, source: null, repos: false,
    prds: [row('P1.1', A, 'Crew API skeleton'), row('P2.1', B, 'Think endpoint', ['P1.1']), row('P3.1', C, 'Docs')],
    questions,
  });
  const pr = (over: Partial<PrStanding> = {}): PrStanding => ({
    repo: 'widgets', number: parsePr(31), url: PR_URL, state: 'OPEN', isDraft: true,
    createdAt: null, mergedAt: null, closedAt: null, questions: 0, ...over,
  });
  const standingOf = (prs: PrStanding[]): PrdStanding => ({ shipped: false, prs, expected: 1 });
  type ReadOver = { questions?: RoadmapQuestion[]; answers?: Record<string, string>; words?: Record<string, string> };
  const read = (blocker: PrStanding[], { questions = [], answers = {}, words = {} }: ReadOver = {}): RoadmapRead => ({
    roadmap: roadmap(questions),
    answers: new Map(Object.entries(answers)),
    standings: new Map([['P1.1', standingOf(blocker)]]),
    live: new Map(Object.entries(words)),
    issueLink: ISSUE,
  });
  const roadmapPlan = planLoop({
    prds: [prd(A, [slice('s1', ['a/'], 1)]), prd(B, [slice('s1', ['b/'], 1)], { blockedBy: [A] }), prd(C, [slice('s1', ['c/'], 1)])],
    shipped: [],
  });
  const tick = (verdicts: Verdict[], gates: RoadmapRead) => followPlan(roadmapPlan, { ...live(verdicts), gates: roadmapGates(gates) });
  const gateOfB = (gates: RoadmapRead) => roadmapGates(gates).get(B);

  it('the held why reads waits on <repo>#<pr> (<id> <title>): <state>, for each state the spec names', () => {
    const line = (state: string) => `waits on widgets#31 (P1.1 Crew API skeleton): ${state}`;
    expect(gateOfB(read([pr()], { words: { 'P1.1': 'building wave 2/3' } }))).toEqual({ kind: 'hold', why: line('building wave 2/3'), link: PR_URL });
    expect(gateOfB(read([pr({ questions: 2 })]))?.why).toBe(line('outbox: 2 questions'));
    expect(gateOfB(read([pr({ isDraft: false })], { words: { 'P1.1': 'CI red' } }))?.why).toBe(line('CI red'));
    expect(gateOfB(read([pr({ isDraft: false })]))?.why).toBe(line('ready, waiting for your merge'));
    expect(gateOfB(read([]))).toEqual({ kind: 'hold', why: 'waits on P1.1 Crew API skeleton: not started' });
    expect(gateOfB(read([pr({ state: 'MERGED' })]))).toBeUndefined();
  });

  it('in a plan repository the line names the first of its PRs still open', () => {
    const plans = pr({ repo: 'plans', number: parsePr(12), url: 'https://github.com/acme/plans/pull/12', state: 'MERGED', isDraft: false });
    const crew = pr({ repo: 'crew', number: parsePr(40), url: 'https://github.com/acme/crew/pull/40', isDraft: false });
    const standings = new Map([['P1.1', { shipped: false, prs: [plans, crew], expected: 2 }]]);
    expect(roadmapGates({ ...read([]), standings }).get(B)?.why).toBe('waits on crew#40 (P1.1 Crew API skeleton): ready, waiting for your merge');
  });

  it('a held PRD waits while every other step runs', () => {
    expect(tick([act(A), act(B), act(C)], read([pr()]))).toMatchObject({ state: 'step', step: { prd: 1201 } });
    expect(tick([wait(A), act(B), act(C)], read([pr()]))).toMatchObject({ state: 'step', verdict: { prd: 1203, verdict: 'act' } });
    expect(tick([park(A), act(B), done(C)], read([pr()]))).toEqual({
      state: 'stop',
      waiting: [park(A), { prd: 1202, verdict: 'park', why: 'waits on widgets#31 (P1.1 Crew API skeleton): building', link: PR_URL }],
    });
  });

  it('a person question not answered parks only the PRDs it blocks and names it; answered, the next call takes them up', () => {
    const question: RoadmapQuestion = { id: 'Q5', question: 'Which bank?', recommendation: '–', blocks: ['P3.1'], kind: 'person' };
    const asked = read([pr({ state: 'MERGED' })], { questions: [question] });
    expect(tick([done(A), act(B), act(C)], asked)).toMatchObject({ state: 'step', verdict: { prd: 1202, verdict: 'act' } });
    expect(tick([done(A), done(B), act(C)], asked)).toEqual({
      state: 'stop',
      waiting: [{ prd: 1203, verdict: 'park', why: 'waits on a person: roadmap 1200 question Q5 is not answered (Which bank?); answer it with omni roadmap answer 1200 Q5 "<answer>"', link: ISSUE }],
    });
    const answered = read([pr({ state: 'MERGED' })], { questions: [question], answers: { Q5: 'the first' } });
    expect(tick([done(A), done(B), act(C)], answered)).toMatchObject({ state: 'step', verdict: { prd: 1203, verdict: 'act' } });
    expect(roadmapGates(read([pr({ state: 'MERGED' })], { questions: [{ ...question, kind: 'default' }] })).has(C)).toBe(false);
  });

  it('a blocker closed unmerged parks its dependents', () => {
    const closed = read([pr({ state: 'CLOSED' })]);
    const parked = { prd: 1202, verdict: 'park', why: 'blocker #31 closed unmerged: fix the roadmap', link: PR_URL };
    expect(gateOfB(closed)).toEqual({ kind: 'park', why: parked.why, link: PR_URL });
    expect(tick([done(A), act(B), done(C)], closed)).toEqual({ state: 'stop', waiting: [parked] });
  });

  it('the finer words: the wave a blocker builds, and red CI on its ready PR', () => {
    const facts = (checks: 'red' | 'green'): PrdFacts => ({
      prd: A, shipped: false, phase0: null, board: null, outbox: { questions: 0, answered: false },
      feature: { url: 'u', state: 'OPEN', isDraft: false, author: null, checks, fixable: true, stuck: false, conflict: false, threads: 0 },
    });
    const merged = (input: PlanSliceInput): PlanSliceInput => ({ ...input, state: 'merged' });
    const slices = [merged(slice('s1', ['a/'], 1)), slice('s2', ['b/'], 2), slice('s3', ['c/'], 3)];
    expect(liveWords('building', facts('green'), slices)).toBe('building wave 2/3');
    expect(liveWords('building', facts('green'), slices.map(merged))).toBe('building wave 3/3');
    expect(liveWords('building', facts('green'), null)).toBeNull();
    expect(liveWords('ready', facts('red'), slices)).toBe('CI red');
    expect(liveWords('ready', facts('green'), slices)).toBeNull();
    expect(liveWords('outbox', facts('red'), slices)).toBeNull();
  });
});

// PRD 1205, slice s1: up to `slots` steps at once, counting those running, each passing the four rules.
describe('followSteps', () => {
  const NOW = '2026-10-08T08:00:00Z';
  /** What a tick read, with each PRD's slices as ground and what each PRD runs. */
  function pooled(inputs: PrdInput[], verdicts: Verdict[], { merged = {}, shipped = [], running = {} }: { merged?: Record<number, string[]>; shipped?: number[]; running?: Record<number, Running> } = {}): Live {
    return {
      ...live(verdicts, merged, shipped),
      slices: new Map(inputs.map((input) => [input.prd, input.slices ?? []] as const)),
      running: new Map(Object.entries(running).map(([n, run]) => [parsePrd(Number(n)), run] as const)),
    };
  }
  const steps = (pool: Pool) => pool.steps.map(({ step }) => `${step.step}:${step.prd}`);
  const held = (pool: Pool) => pool.held.map(({ step, why }) => `${step.step}:${why}`);
  const P10 = parsePrd(10);
  const inRepo = (input: PlanSliceInput, repo: string): PlanSliceInput => ({ ...input, repo });
  const S1 = parseWorkSliceId('s1');
  const disjoint = [prd(P7, [slice('s1', ['a/'], 1)]), prd(P8, [slice('s1', ['b/'], 1)]), prd(P9, [slice('s1', ['c/'], 1)]), prd(P10, [slice('s1', ['d/'], 1)])];
  const colliding = [prd(P7, [slice('s1', ['a/'], 1), slice('s2', ['b/'], 2)]), prd(P8, [slice('s1', ['a/x'], 1)]), prd(P9, [slice('s1', ['z/'], 1)])];

  it('PRDs sharing no ground: as many steps as slots, each of a different PRD', () => {
    const pool = followSteps(planLoop({ prds: disjoint, shipped: [] }), pooled(disjoint, [act(P7), act(P8), act(P9), act(P10)]), 3);
    expect(steps(pool)).toEqual(['1:7', '2:8', '3:9']);
    expect(pool.steps.map(({ verdict }) => verdict.verdict)).toEqual(['act', 'act', 'act']);
    expect(pool).toMatchObject({ running: [], held: [] });
  });

  it('two PRDs sharing a path in one repository: the first runs, the second is held naming the path and the step', () => {
    const pool = followSteps(plan, pooled(colliding, [act(P7), act(P8), act(P9)]), 3);
    expect(steps(pool)).toEqual(['1:7', '2:9']);
    expect(held(pool)).toEqual(['4:a/ shared with step 1 (PRD 7 w1, starting)']);
  });

  it('the same path in two repositories never collides', () => {
    const inputs = [prd(P7, [inRepo(slice('s1', ['apps/api/'], 1), 'crew')]), prd(P8, [inRepo(slice('s1', ['apps/api/'], 1), 'ai-domain')])];
    const pool = followSteps(planLoop({ prds: inputs, shipped: [] }), pooled(inputs, [act(P7), act(P8)]), 3);
    expect(steps(pool)).toEqual(['1:7', '2:8']);
    expect(pool.held).toEqual([]);
  });

  it('the same path in one named repository collides, the path named by its repository', () => {
    const inputs = [prd(P7, [inRepo(slice('s1', ['apps/api/'], 1), 'crew')]), prd(P8, [inRepo(slice('s1', ['apps/api/'], 1), 'crew')])];
    const pool = followSteps(planLoop({ prds: inputs, shipped: [] }), pooled(inputs, [act(P7), act(P8)]), 3);
    expect(steps(pool)).toEqual(['1:7']);
    expect(held(pool)).toEqual(['3:crew:apps/api/ shared with step 1 (PRD 7 w1, starting)']);
  });

  it('generated paths never collide', () => {
    // Planned on their own ground only, so the plan's order is not what lets them run together.
    const own = [prd(P7, [slice('s1', ['a/'], 1)]), prd(P8, [slice('s1', ['b/'], 1)])];
    const beside = planLoop({ prds: own, shipped: [] });
    const built = [prd(P7, [slice('s1', ['kit/dist/', 'a/'], 1)]), prd(P8, [slice('s1', ['kit/dist/', 'b/'], 1)])];
    expect(steps(followSteps(beside, pooled(built, [act(P7), act(P8)]), 3, [{ path: 'kit/dist/' }]))).toEqual(['1:7', '2:8']);
    expect(held(followSteps(beside, pooled(built, [act(P7), act(P8)]), 3))).toEqual(['2:kit/dist/ shared with step 1 (PRD 7 w1, starting)']);
  });

  it('a step whose PRD is blocked by a PRD not shipped is never offered, and is held saying so', () => {
    const inputs = [prd(P7, [slice('s1', ['a/'], 1)], { blockedBy: [parsePrd(5)] }), prd(P8, [slice('s1', ['b/'], 1)])];
    const blocked = planLoop({ prds: inputs, shipped: [] });
    const pool = followSteps(blocked, pooled(inputs, [act(P7), act(P8)]), 3);
    expect(steps(pool)).toEqual(['2:8']);
    expect(held(pool)).toEqual(['1:waits on PRD 5 to ship']);
    expect(steps(followSteps(blocked, pooled(inputs, [act(P7), act(P8)], { shipped: [5] }), 3))).toEqual(['1:7', '2:8']);
  });

  it("a step that comes after one not done is held on the plan's order", () => {
    const pool = followSteps(plan, pooled(colliding, [park(P7), act(P8), act(P9)]), 3);
    expect(steps(pool)).toEqual(['2:9']);
    expect(held(pool)).toEqual(['4:waits on PRD 7: step 4 comes after step 1']);
  });

  it('a step running counts against the slots, and its PRD gets no second step', () => {
    const four = planLoop({ prds: disjoint, shipped: [] });
    const running: Record<number, Running> = { 7: { kind: 'claims', slices: [S1], since: NOW } };
    const pool = followSteps(four, pooled(disjoint, [act(P7), act(P8), act(P9), act(P10)], { running }), 3);
    expect(pool.running.map(({ step, since }) => `${step.step}:${step.prd}:${since}`)).toEqual([`1:7:${NOW}`]);
    expect(steps(pool)).toEqual(['2:8', '3:9']);
    expect(followSteps(four, pooled(disjoint, [act(P7), act(P8), act(P9), act(P10)], { running }), 1).steps).toEqual([]);
  });

  it('a running step holds every step sharing its ground', () => {
    const running: Record<number, Running> = { 7: { kind: 'claims', slices: [S1], since: NOW } };
    const pool = followSteps(plan, pooled(colliding, [wait(P7), act(P8), act(P9)], { running }), 3);
    expect(steps(pool)).toEqual(['2:9']);
    expect(held(pool)).toEqual(['4:a/ shared with step 1 (PRD 7 w1, running)']);
  });

  it('a PRD running another step than its first one not done holds that one: no two steps of one PRD', () => {
    const running: Record<number, Running> = { 7: { kind: 'claims', slices: [parseWorkSliceId('s2')], since: NOW } };
    const pool = followSteps(plan, pooled(colliding, [act(P7), done(P8), done(P9)], { running }), 3);
    expect(pool.running.map(({ step }) => step.step)).toEqual([3]);
    expect(pool.steps).toEqual([]);
    expect(held(pool)).toEqual(['1:PRD 7 runs step 3 (PRD 7 w2, running)']);
  });

  it('a feature PR holding the in-progress label runs its first step not done, whatever it is', () => {
    const running: Record<number, Running> = { 7: { kind: 'label', since: NOW } };
    const finishing = followSteps(plan, pooled(colliding, [act(P7), done(P8), done(P9)], { merged: { 7: ['s1', 's2'] }, running }), 3);
    expect(finishing.running.map(({ step }) => `${step.step}:${step.kind}`)).toEqual(['6:finish']);
    expect(followSteps(plan, pooled(colliding, [act(P7), done(P8), done(P9)], { running }), 3).running.map(({ step }) => step.step)).toEqual([1]);
  });

  it('a PRD that is done runs nothing, whatever was read of it', () => {
    const running: Record<number, Running> = { 9: { kind: 'label', since: NOW } };
    expect(followSteps(plan, pooled(colliding, [act(P7), act(P8), done(P9)], { running }), 3).running).toEqual([]);
  });

  it("a finish step's ground is every slice of its PRD", () => {
    const inputs = [prd(P7, [slice('s1', ['a/'], 1)]), prd(P8, [slice('s1', ['a/x'], 1)])];
    const finishing = planLoop({ prds: inputs, shipped: [] });
    const pool = followSteps(finishing, pooled(inputs, [act(P7), act(P8)], { merged: { 7: ['s1'] } }), 3);
    expect(pool.steps.map(({ step }) => `${step.prd}:${step.kind}`)).toEqual(['7:finish']);
    const finish = pool.steps[0]?.step.step;
    expect(pool.held.map(({ step, why }) => `${step.prd}:${why}`)).toEqual([`8:a/ shared with step ${String(finish)} (PRD 7 finish, starting)`]);
  });

  it('a wait launches nothing, and a parked or done PRD is passed over', () => {
    expect(followSteps(plan, pooled(colliding, [wait(P7), park(P8), done(P9)]), 3)).toEqual({ steps: [], running: [], held: [] });
  });

  it("with one slot, the step offered is exactly followPlan's, whenever it acts", () => {
    const cases: Live[] = [
      live([act(P7), act(P8), act(P9)]),
      live([act(P7), act(P8), done(P9)], { 7: ['s1'] }),
      live([wait(P7), act(P8), act(P9)]),
      live([wait(P7), act(P8), wait(P9)]),
      live([park(P7), act(P8), act(P9)]),
      live([done(P7), act(P8), done(P9)]),
      live([park(P7), act(P8), done(P9)]),
      live([done(P7), done(P8), done(P9)]),
    ];
    for (const one of cases) {
      const followed = followPlan(plan, one);
      const expected = followed.state === 'step' && followed.verdict.verdict === 'act' ? [{ step: followed.step, verdict: followed.verdict }] : [];
      expect(followSteps(plan, one, 1).steps).toEqual(expected);
    }
  });

  it('the step followPlan takes comes first', () => {
    expect(steps(followSteps(plan, pooled(colliding, [wait(P7), act(P8), act(P9)]), 3))).toEqual(['2:9']);
    expect(steps(followSteps(plan, pooled(colliding, [act(P7), act(P8), act(P9)]), 3))[0]).toBe('1:7');
  });
});
