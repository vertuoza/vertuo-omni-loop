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
import type { PrdNumber, WorkSliceId } from '../ids.ts';
import type { Verdict } from './decide.ts';
import type { LoopPlan, Step } from './plan.ts';

/** What a tick read live. */
export type Live = {
  verdicts: ReadonlyMap<PrdNumber, Verdict>;
  merged: ReadonlyMap<PrdNumber, ReadonlySet<WorkSliceId>>;
  shipped: ReadonlySet<PrdNumber>;
};

/** The tick's step and its verdict, or the loop's stop with what each PRD waits on. */
export type Followed = { state: 'step'; step: Step; verdict: Verdict } | { state: 'stop'; waiting: Verdict[] };

/** Why a step cannot run yet, or `null` when it can. */
type Hold = { prd: PrdNumber; why: string } | null;

function isDone(step: Step, live: Live): boolean {
  if (live.verdicts.get(step.prd)?.verdict === 'done') return true;
  if (step.kind !== 'wave') return false;
  const merged = live.merged.get(step.prd);
  return step.slices.every((id) => merged?.has(id) === true);
}

/** What holds `step`: a PRD outside the loop not shipped, or a step before it not done. */
function holdOf(step: Step, plan: LoopPlan, done: ReadonlySet<number>, live: Live): Hold {
  const unshipped = step.waitsFor.find((prd) => !live.shipped.has(prd));
  if (unshipped !== undefined) return { prd: step.prd, why: `waits on PRD ${unshipped} to ship` };
  const before = step.after.find((n) => !done.has(n));
  if (before === undefined) return null;
  const other = plan.steps.find((candidate) => candidate.step === before);
  return { prd: step.prd, why: `waits on PRD ${other?.prd ?? step.prd}: step ${step.step} comes after step ${before}` };
}

/** What every PRD not done waits on, in the plan's PRD order: its parked verdict, or what holds it. */
function waitingOf(plan: LoopPlan, live: Live, holds: ReadonlyMap<PrdNumber, Hold>): Verdict[] {
  return plan.prds.flatMap((prd): Verdict[] => {
    const verdict = live.verdicts.get(prd);
    if (verdict?.verdict === 'done') return [];
    if (verdict?.verdict === 'park') return [verdict];
    const hold = holds.get(prd);
    return hold ? [{ prd, verdict: 'park', why: hold.why }] : [];
  });
}

/** One walk of the plan: what it read, the steps done, and the first hold met per PRD. */
type Walk = { plan: LoopPlan; live: Live; done: ReadonlySet<number>; holds: Map<PrdNumber, Hold> };

/** The verdict `step` runs with now, or null when it is done, parked or held (its hold kept). */
function runnableVerdict(step: Step, { plan, live, done, holds }: Walk): Verdict | null {
  if (done.has(step.step)) return null;
  const verdict = live.verdicts.get(step.prd);
  if (!verdict || verdict.verdict === 'park') return null;
  const hold = holdOf(step, plan, done, live);
  if (hold === null) return verdict;
  if (!holds.has(step.prd)) holds.set(step.prd, hold);
  return null;
}

/** The step a tick takes on `plan`, given what it read `live`. */
export function followPlan(plan: LoopPlan, live: Live): Followed {
  const done = new Set(plan.steps.filter((step) => isDone(step, live)).map((step) => step.step));
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
