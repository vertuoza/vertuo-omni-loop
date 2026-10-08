// PRD 1139, slice s3: following the frozen loop plan. Pure: on each tick the command hands it the
// plan and what it read live (each PRD's verdict, its merged slices, the PRDs shipped), and this says
// which step the tick takes.
//
// Steps are read in order. A step is done when its PRD is done, or, for a wave, when every slice of
// it is merged. A step not done is passed over when its PRD is parked (it waits on a person), and is
// held when a step it comes after is not done or a PRD it waits for has not shipped. The first step
// left is the tick's: its PRD's verdict. When that verdict is a `wait`, a later step the plan marked
// beside it whose verdict is an `act` is taken instead; no other later step ever is. With no step
// left, the loop stops, and says what each PRD not done waits on.
//
// PRD 1162, slice s7, a roadmap (`omni next --roadmap <n>`): the tick also reads each PRD's gate
// (`roadmap.ts`). A `park` gate parks the PRD as a parked verdict would, its why the gate's; a `hold`
// gate holds the PRD's first step, its why the waits-on line, while every other step runs.
//
// PRD 1205, slice s1, the pool (`followSteps`): a tick launches up to `limits.parallelSteps` steps at
// once, counting the ones already running (read from GitHub by the command: a live claim on a slice,
// or the feature PR's in-progress label with a fresh status comment). Each PRD offers its first step
// not done, the step `followPlan` takes first, and a step is offered only when its verdict acts and it
// passes four rules against every step running or offered: another PRD, no open blocker, no shared
// ground in one repository (generated paths ignored), and the plan's order. A step a rule keeps back
// is held, with one line naming the rule and the other step.
import type { PrdNumber, WorkSliceId } from '../ids.ts';
import { sharedGround } from '../inbox/territory.ts';
import type { Generated } from '../inbox/territory.ts';
import type { Verdict } from './decide.ts';
import type { LoopPlan, PlanSliceInput, Step } from './plan.ts';
import type { Gate } from './roadmap.ts';

/** What a PRD runs now, as GitHub shows it: a wave holding live claims on `slices`, or its finish
 * (finish, yolo-fix or PR care) holding the in-progress label; `since` is when it was last seen to. */
export type Running = { kind: 'wave'; slices: WorkSliceId[]; since: string } | { kind: 'finish'; since: string };

/** What a tick read live. */
export type Live = {
  verdicts: ReadonlyMap<PrdNumber, Verdict>;
  merged: ReadonlyMap<PrdNumber, ReadonlySet<WorkSliceId>>;
  shipped: ReadonlySet<PrdNumber>;
  /** Under a roadmap: what it holds each PRD on; a PRD free to run is absent. */
  gates?: ReadonlyMap<PrdNumber, Gate>;
  /** PRD 1205: what each PRD runs now; a PRD running nothing is absent. */
  running?: ReadonlyMap<PrdNumber, Running>;
  /** PRD 1205: each PRD's slices with their territory, the ground the collision check reads. */
  slices?: ReadonlyMap<PrdNumber, readonly PlanSliceInput[]>;
};

/** The tick's step and its verdict, or the loop's stop with what each PRD waits on. */
export type Followed = { state: 'step'; step: Step; verdict: Verdict } | { state: 'stop'; waiting: Verdict[] };

/** Why a step cannot run yet, or `null` when it can. */
type Hold = { prd: PrdNumber; why: string; link?: string } | null;

/** PRD `prd`'s verdict this tick: what it read live, parked instead when a roadmap parks it. */
function verdictOf(prd: PrdNumber, live: Live): Verdict | undefined {
  const verdict = live.verdicts.get(prd);
  const gate = live.gates?.get(prd);
  if (!verdict || verdict.verdict === 'done' || gate?.kind !== 'park') return verdict;
  return { prd, verdict: 'park', why: gate.why, ...(gate.link ? { link: gate.link } : {}), ...(verdict.repos ? { repos: verdict.repos } : {}) };
}

function isDone(step: Step, live: Live): boolean {
  if (verdictOf(step.prd, live)?.verdict === 'done') return true;
  if (step.kind !== 'wave') return false;
  const merged = live.merged.get(step.prd);
  return step.slices.every((id) => merged?.has(id) === true);
}

/** What blocks `step`: a roadmap holding its PRD's first step, or a PRD outside the loop not shipped. */
function blockerOf(step: Step, plan: LoopPlan, live: Live): Hold {
  const gate = live.gates?.get(step.prd);
  if (gate?.kind === 'hold' && plan.steps.find((candidate) => candidate.prd === step.prd) === step) {
    return { prd: step.prd, why: gate.why, ...(gate.link ? { link: gate.link } : {}) };
  }
  const unshipped = step.waitsFor.find((prd) => !live.shipped.has(prd));
  return unshipped === undefined ? null : { prd: step.prd, why: `waits on PRD ${unshipped} to ship` };
}

/** What holds `step`: what blocks it, or a step before it not done. */
function holdOf(step: Step, plan: LoopPlan, done: ReadonlySet<number>, live: Live): Hold {
  return blockerOf(step, plan, live) ?? orderOf(step, plan, done);
}

/** The step before `step` that is not done, as a hold; `null` when every one is. */
function orderOf(step: Step, plan: LoopPlan, done: ReadonlySet<number>): Hold {
  const before = step.after.find((n) => !done.has(n));
  if (before === undefined) return null;
  const other = plan.steps.find((candidate) => candidate.step === before);
  return { prd: step.prd, why: `waits on PRD ${other?.prd ?? step.prd}: step ${step.step} comes after step ${before}` };
}

/** What every PRD not done waits on, in the plan's PRD order: its parked verdict, or what holds it. */
function waitingOf(plan: LoopPlan, live: Live, holds: ReadonlyMap<PrdNumber, Hold>): Verdict[] {
  return plan.prds.flatMap((prd): Verdict[] => {
    const verdict = verdictOf(prd, live);
    if (verdict?.verdict === 'done') return [];
    if (verdict?.verdict === 'park') return [verdict];
    const hold = holds.get(prd);
    return hold ? [{ prd, verdict: 'park', why: hold.why, ...(hold.link ? { link: hold.link } : {}) }] : [];
  });
}

/** One walk of the plan: what it read, the steps done, and the first hold met per PRD. */
type Walk = { plan: LoopPlan; live: Live; done: ReadonlySet<number>; holds: Map<PrdNumber, Hold> };

/** The verdict `step` runs with now, or null when it is done, parked or held (its hold kept). */
function runnableVerdict(step: Step, { plan, live, done, holds }: Walk): Verdict | null {
  if (done.has(step.step)) return null;
  const verdict = verdictOf(step.prd, live);
  if (!verdict || verdict.verdict === 'park') return null;
  const hold = holdOf(step, plan, done, live);
  if (hold === null) return verdict;
  if (!holds.has(step.prd)) holds.set(step.prd, hold);
  return null;
}

/** The steps of `plan` done, by number. */
const doneOf = (plan: LoopPlan, live: Live): Set<number> => new Set(plan.steps.filter((step) => isDone(step, live)).map((step) => step.step));

/** The step a tick takes on `plan`, given what it read `live`. */
export function followPlan(plan: LoopPlan, live: Live): Followed {
  const done = doneOf(plan, live);
  const walk: Walk = { plan, live, done, holds: new Map<PrdNumber, Hold>() };
  let waiting: { step: Step; verdict: Verdict } | null = null;
  for (const step of plan.steps) {
    const verdict = runnableVerdict(step, walk);
    if (verdict === null) continue;
    if (waiting === null) {
      if (verdict.verdict !== 'wait') return { state: 'step', step, verdict };
      waiting = { step, verdict };
    } else if (verdict.verdict === 'act' && waiting.step.beside.includes(step.step)) {
      return { state: 'step', step, verdict };
    }
  }
  if (waiting !== null) return { state: 'step', ...waiting };
  return { state: 'stop', waiting: waitingOf(plan, live, walk.holds) };
}

/** A tick's pool: the steps to launch now with their verdicts, the steps running, and each step a rule
 * keeps back with why. */
export type Pool = { steps: { step: Step; verdict: Verdict }[]; running: { step: Step; since: string }[]; held: { step: Step; why: string }[] };

/** A step running or offered this tick. */
type Busy = { step: Step; running: boolean };

/** A step in words, for a held line: `step 4 (PRD 12 w1, running)`. */
function stepRef({ step, running }: Busy): string {
  const what = step.kind !== 'wave' ? step.kind : step.wave === null ? 'slices with no wave' : `w${step.wave}`;
  return `step ${step.step} (PRD ${step.prd} ${what}, ${running ? 'running' : 'starting'})`;
}

/** The step PRD `prd`'s running work is: the wave holding its claims, or its finish; else its first
 * step not done. */
function runningStep(prd: PrdNumber, running: Running, plan: LoopPlan, done: ReadonlySet<number>): Step | undefined {
  const own = plan.steps.filter((step) => step.prd === prd && !done.has(step.step));
  const found = running.kind === 'wave' ? own.find((step) => step.kind === 'wave' && step.slices.some((id) => running.slices.includes(id))) : own.find((step) => step.kind === 'finish');
  return found ?? own[0];
}

/** The ground `step` stands on: its slices, or for a finish every slice of its PRD; none for a plan. */
function groundOf(step: Step, live: Live): readonly PlanSliceInput[] {
  const slices = live.slices?.get(step.prd) ?? [];
  if (step.kind === 'finish') return slices;
  return slices.filter((slice) => step.slices.includes(slice.id));
}

/** The paths two steps share in one repository, each `<repo>:<path>` in a named one, generated ones left out. */
function sharedOf(a: Step, b: Step, live: Live, generated: readonly Generated[]): string[] {
  const shared = new Set<string>();
  for (const left of groundOf(a, live)) {
    for (const right of groundOf(b, live)) {
      const repo = left.repo ?? null;
      if (repo !== (right.repo ?? null)) continue;
      for (const path of sharedGround(left, right, generated)) shared.add(repo === null ? path : `${repo}:${path}`);
    }
  }
  return [...shared].sort();
}

/** Why the four rules keep `step` back from running beside `busy`, or `null` when they do not. */
function keptBack(step: Step, busy: readonly Busy[], { plan, live, done, generated }: { plan: LoopPlan; live: Live; done: ReadonlySet<number>; generated: readonly Generated[] }): string | null {
  const same = busy.find((other) => other.step.prd === step.prd);
  if (same) return `PRD ${step.prd} runs ${stepRef(same)}`;
  const blocker = blockerOf(step, plan, live);
  if (blocker !== null) return blocker.why;
  for (const other of busy) {
    const shared = sharedOf(step, other.step, live, generated);
    if (shared.length > 0) return `${shared.join(', ')} shared with ${stepRef(other)}`;
  }
  return orderOf(step, plan, done)?.why ?? null;
}

/** The steps running, from what each PRD runs; a PRD done runs nothing. */
function runningOf(plan: LoopPlan, live: Live, done: ReadonlySet<number>): Pool['running'] {
  const running = [...(live.running ?? new Map<PrdNumber, Running>())].flatMap(([prd, run]) => {
    if (verdictOf(prd, live)?.verdict === 'done') return [];
    const step = runningStep(prd, run, plan, done);
    return step ? [{ step, since: run.since }] : [];
  });
  return running.sort((a, b) => a.step.step - b.step.step);
}

/** The steps a tick may offer, in order: the one `followPlan` takes when it acts, then each PRD's
 * first step not done, in plan order. */
function candidatesOf(plan: LoopPlan, live: Live, done: ReadonlySet<number>): Step[] {
  const followed = followPlan(plan, live);
  const first = followed.state === 'step' && followed.verdict.verdict === 'act' ? [followed.step] : [];
  const seen = new Set<PrdNumber>();
  const firsts = plan.steps.filter((step) => {
    if (done.has(step.step) || seen.has(step.prd)) return false;
    seen.add(step.prd);
    return true;
  });
  return [...first, ...firsts.filter((step) => !first.includes(step))];
}

/** PRD 1205: the pool a tick on `plan` launches, up to `slots` steps running at once, counting those
 * running; `generated` paths never collide. */
export function followSteps(plan: LoopPlan, live: Live, slots: number, generated: readonly Generated[] = []): Pool {
  const done = doneOf(plan, live);
  const running = runningOf(plan, live, done);
  const busy: Busy[] = running.map(({ step }) => ({ step, running: true }));
  const pool: Pool = { steps: [], running, held: [] };
  for (const step of candidatesOf(plan, live, done)) {
    const verdict = verdictOf(step.prd, live);
    if (verdict?.verdict !== 'act' || running.some((one) => one.step === step)) continue;
    const why = keptBack(step, busy, { plan, live, done, generated });
    if (why !== null) pool.held.push({ step, why });
    else if (busy.length < slots) {
      pool.steps.push({ step, verdict });
      busy.push({ step, running: false });
    }
  }
  return pool;
}
