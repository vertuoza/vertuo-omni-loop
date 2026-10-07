// PRD 1139, slice s3: replanning. The loop plan changes only when reality breaks it: a slice goes
// stuck, a slice is added or dropped, a PRD gets its plan, or a PRD ships or closes before every
// slice of it merged. Then the tick writes the next version with one line saying why
// (`replanned v2: s4 of PRD 1030 stuck → 1040 moves up`). Slices merging, claims moving and a PRD
// ending once all its slices merged are the plan being followed: no new version. Pure.
import type { PrdNumber } from '../ids.ts';
import { planLoop } from './plan.ts';
import type { LoopPlan, PlanInputs, PrdInput, Seen, Step } from './plan.ts';

/** What changed for one PRD since the plan saw it, one phrase each. */
function changesOf(seen: Seen | undefined, input: PrdInput): string[] {
  if (seen === undefined) return [`PRD ${input.prd} added`];
  return [...sliceChanges(seen, input), ...stuckChanges(seen, input), ...endedChanges(seen, input)];
}

/** The PRD planned since, or the slices added to and dropped from its plan. */
function sliceChanges(seen: Seen, input: PrdInput): string[] {
  const now = input.slices;
  if (now === null) return [];
  if (seen.slices === null) return [`PRD ${input.prd} planned`];
  const before = new Set(seen.slices);
  const after = new Set(now.map((slice) => slice.id));
  const added = [...after].filter((id) => !before.has(id)).sort();
  const dropped = [...before].filter((id) => !after.has(id)).sort();
  return [
    ...(added.length > 0 ? [`${added.join(', ')} added to PRD ${input.prd}`] : []),
    ...(dropped.length > 0 ? [`${dropped.join(', ')} dropped from PRD ${input.prd}`] : []),
  ];
}

/** The slices of the PRD that went stuck since. */
function stuckChanges(seen: Seen, input: PrdInput): string[] {
  const wasStuck = new Set(seen.stuck);
  const stuck = (input.slices ?? []).filter((slice) => slice.state === 'stuck' && !wasStuck.has(slice.id)).map((slice) => slice.id).sort();
  return stuck.length > 0 ? [`${stuck.join(', ')} of PRD ${input.prd} stuck`] : [];
}

/** The PRD shipped or closed since, before every slice of it merged. */
function endedChanges(seen: Seen, input: PrdInput): string[] {
  const now = input.slices;
  const early = now === null || now.some((slice) => slice.state !== 'merged');
  return seen.ended === null && input.ended !== null && early ? [`PRD ${input.prd} ${input.ended} early`] : [];
}

/** Whether a step is done by `inputs`: its PRD ended, or every slice of its wave merged. */
function doneBy(inputs: PlanInputs): (step: Step) => boolean {
  const byPrd = new Map(inputs.prds.map((input) => [input.prd, input] as const));
  return (step) => {
    const input = byPrd.get(step.prd);
    if (!input || input.ended !== null) return true;
    if (step.kind !== 'wave') return false;
    const merged = new Set((input.slices ?? []).filter((slice) => slice.state === 'merged').map((slice) => slice.id));
    return step.slices.every((id) => merged.has(id));
  };
}

/** For each PRD with a step not done, how many steps not done come before its first. */
function openBefore(plan: LoopPlan, done: (step: Step) => boolean): Map<PrdNumber, number> {
  const open = plan.steps.filter((step) => !done(step));
  const before = new Map<PrdNumber, number>();
  for (const [index, step] of open.entries()) if (!before.has(step.prd)) before.set(step.prd, index);
  return before;
}

/** The PRDs the new plan brings forward, in its PRD order. */
function movedUp(old: LoopPlan, fresh: LoopPlan, inputs: PlanInputs): PrdNumber[] {
  const done = doneBy(inputs);
  const was = openBefore(old, done);
  const now = openBefore(fresh, done);
  return [...now.entries()].filter(([prd, index]) => index < (was.get(prd) ?? index)).map(([prd]) => prd);
}

/** The next version of `plan` when `inputs` break it, or `null` when nothing changed. */
export function replan(plan: LoopPlan, inputs: PlanInputs): LoopPlan | null {
  const seen = new Map(plan.seen.map((entry) => [entry.prd, entry] as const));
  const changes = [...inputs.prds].sort((a, b) => a.prd - b.prd).flatMap((input) => changesOf(seen.get(input.prd), input));
  if (changes.length === 0) return null;
  const draft = planLoop(inputs, { version: plan.version + 1 });
  const moved = movedUp(plan, draft, inputs);
  const reason = `${changes.join('; ')}${moved.length > 0 ? ` → ${moved.join(', ')} moves up` : ''}`;
  return { ...draft, reason };
}

/** The line a tick prints when it replans. */
export function replanLine(plan: LoopPlan): string {
  return `replanned v${plan.version}: ${plan.reason ?? 'no reason given'}`;
}
