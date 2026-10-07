// PRD 1139, slice s3: the loop plan — every slice of every PRD a loop drives, ordered into one
// numbered sequence of steps. Pure: the command (`kit/bin/commands/next.ts`) reads each PRD's plan,
// board and spec, and this orders them. The same inputs always give the same plan.
//
// - A step is one wave of one PRD (its slices), then one `finish` step per PRD (yolo's finish, the
//   gate, PR care until it parks or merges). A PRD with no plan yet is a single `plan` step.
// - Each PRD's steps keep their order; a slice with no wave runs after the numbered waves.
// - Two wave steps of different PRDs whose slices share territory run in series, the PRD first in
//   the PRD order first, and the later step says why: `1017 s2 after 1030 s3: both touch nav/`. A
//   step already done (every slice merged) orders nothing.
// - A PRD whose `blocked-by` names a driven PRD starts after that PRD's finish step; one naming a
//   PRD outside the loop that has not shipped waits for it to ship (`waitsFor`).
// - The PRD order: blockers before the PRDs they block, then PRDs with no stuck slice before those
//   with one (they wait on a person), then the lower number first.
// - Steps are numbered by depth (how many steps must be done before them), then PRD order, then
//   their order in their PRD. Steps of the same depth never depend on each other: each is marked to
//   run `beside` the others.
import type { SliceState } from '../board.ts';
import type { PrdNumber, WorkSliceId } from '../ids.ts';
import { sharedGround } from '../inbox/territory.ts';

/** One slice of a driven PRD, as its plan declares it and its board reads it. */
export type PlanSliceInput = { id: WorkSliceId; territory: string[]; wave: number | null; state: SliceState };

/** How a PRD ended, when it has: its feature PR merged or closed, or its folder shipped. */
export type Ended = 'merged' | 'closed' | 'shipped';

/** One driven PRD: its spec's `blocked-by`, its slices (`null` with no plan yet) and how it ended. */
export type PrdInput = { prd: PrdNumber; blockedBy: PrdNumber[]; slices: PlanSliceInput[] | null; ended: Ended | null };

/** What the plan is computed from: the driven PRDs, and the PRDs known to have shipped. */
export type PlanInputs = { prds: readonly PrdInput[]; shipped: readonly PrdNumber[] };

export type StepKind = 'plan' | 'wave' | 'finish';

/** One step of the loop plan. */
export type Step = {
  step: number;
  prd: PrdNumber;
  kind: StepKind;
  wave: number | null;
  slices: WorkSliceId[];
  /** The steps that must be done first. */
  after: number[];
  /** PRDs outside the loop this step waits for to ship. */
  waitsFor: PrdNumber[];
  /** Why this step waits on another PRD, one line each. */
  why: string[];
  /** The steps it may run beside. */
  beside: number[];
};

/** What a plan version saw of one PRD, so a later tick can tell what changed. */
export type Seen = { prd: PrdNumber; slices: WorkSliceId[] | null; stuck: WorkSliceId[]; ended: Ended | null };

/** One version of the loop plan. */
export type LoopPlan = { version: number; reason: string | null; prds: PrdNumber[]; steps: Step[]; seen: Seen[] };

/** A step before it is numbered. */
type Unit = { prd: PrdNumber; order: number; index: number; kind: StepKind; wave: number | null; slices: PlanSliceInput[]; done: boolean; deps: Set<Unit>; waitsFor: PrdNumber[]; why: string[] };

const byNumber = (a: number, b: number): number => a - b;

/** Whether a PRD has a slice waiting on a person. */
const hasStuck = (input: PrdInput): boolean => (input.slices ?? []).some((slice) => slice.state === 'stuck');

/** The PRD order: blockers first, then no stuck slice before a stuck one, then the lower number. */
function prdOrder(prds: readonly PrdInput[]): PrdInput[] {
  const key = (input: PrdInput): [number, number] => [hasStuck(input) ? 1 : 0, input.prd];
  const sorted = [...prds].sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1]);
  const driven = new Set(sorted.map((input) => input.prd));
  const placed: PrdInput[] = [];
  const left = [...sorted];
  while (left.length > 0) {
    const done = new Set(placed.map((input) => input.prd));
    const ready = left.findIndex((input) => input.blockedBy.every((blocker) => !driven.has(blocker) || done.has(blocker)));
    // A cycle of blockers: the first left goes anyway, so the plan always ends.
    const [next] = left.splice(ready === -1 ? 0 : ready, 1);
    if (next) placed.push(next);
  }
  return placed;
}

/** A PRD's waves in order, a slice with no wave last, each in the plan's slice order. */
function wavesOf(slices: readonly PlanSliceInput[]): { wave: number | null; slices: PlanSliceInput[] }[] {
  const numbers = [...new Set(slices.map((slice) => slice.wave).filter((wave) => wave !== null))].sort(byNumber);
  const waves = numbers.map((wave) => ({ wave, slices: slices.filter((slice) => slice.wave === wave) }));
  const loose = slices.filter((slice) => slice.wave === null);
  return loose.length > 0 ? [...waves, { wave: null, slices: loose }] : waves;
}

/** A PRD's units, each after the one before it. */
function unitsOf(input: PrdInput, order: number): Unit[] {
  const ended = input.ended !== null;
  const unit = (index: number, kind: StepKind, wave: number | null, slices: PlanSliceInput[], done: boolean): Unit => ({
    prd: input.prd,
    order,
    index,
    kind,
    wave,
    slices,
    done,
    deps: new Set(),
    waitsFor: [],
    why: [],
  });
  if (input.slices === null) return [unit(0, 'plan', null, [], ended)];
  const waves = wavesOf(input.slices).map(({ wave, slices }, index) =>
    unit(index, 'wave', wave, slices, ended || slices.every((slice) => slice.state === 'merged')),
  );
  const units = [...waves, unit(waves.length, 'finish', null, [], ended)];
  for (const [index, current] of units.entries()) {
    const before = units[index - 1];
    if (before && !before.done && !current.done) current.deps.add(before);
  }
  return units;
}

/** The ground two wave units share, and the slices of each that meet. */
function meeting(first: Unit, second: Unit): { shared: string[]; left: WorkSliceId[]; right: WorkSliceId[] } {
  const shared = new Set<string>();
  const left = new Set<WorkSliceId>();
  const right = new Set<WorkSliceId>();
  for (const a of first.slices) {
    for (const b of second.slices) {
      const ground = sharedGround(a, b);
      if (ground.length === 0) continue;
      for (const path of ground) shared.add(path);
      left.add(a.id);
      right.add(b.id);
    }
  }
  return { shared: [...shared].sort(), left: [...left], right: [...right] };
}

/** Orders every pair of colliding wave units of different PRDs, the earlier PRD first. */
function orderCollisions(units: readonly Unit[]): void {
  const waves = units.filter((unit) => unit.kind === 'wave' && !unit.done);
  for (const [i, first] of waves.entries()) {
    for (const second of waves.slice(i + 1)) {
      if (first.prd === second.prd) continue;
      const [earlier, later] = first.order < second.order ? [first, second] : [second, first];
      const { shared, left, right } = meeting(earlier, later);
      if (shared.length === 0) continue;
      later.deps.add(earlier);
      later.why.push(`${later.prd} ${right.join(', ')} after ${earlier.prd} ${left.join(', ')}: both touch ${shared.join(', ')}`);
    }
  }
}

/** Holds each PRD's first unit on its blockers: a driven one's finish, or the ship of one outside. */
function orderBlockers(ordered: readonly PrdInput[], unitsByPrd: ReadonlyMap<PrdNumber, Unit[]>, shipped: ReadonlySet<PrdNumber>): void {
  for (const input of ordered) {
    const first = unitsByPrd.get(input.prd)?.find((unit) => !unit.done);
    if (!first) continue;
    for (const blocker of [...input.blockedBy].sort(byNumber)) {
      const theirs = unitsByPrd.get(blocker);
      if (theirs) {
        const finish = theirs.at(-1);
        if (!finish || finish.done) continue;
        first.deps.add(finish);
        first.why.push(`${input.prd} after ${blocker}: blocked by it until it ships`);
      } else if (!shipped.has(blocker)) {
        first.waitsFor.push(blocker);
        first.why.push(`${input.prd} waits for ${blocker} to ship`);
      }
    }
  }
}

/** How many units must be done before `unit`, at most. */
function depthOf(unit: Unit, memo: Map<Unit, number>, seen: Set<Unit> = new Set()): number {
  const known = memo.get(unit);
  if (known !== undefined) return known;
  // A cycle (blockers that block each other) is cut where it closes.
  if (seen.has(unit)) return 0;
  seen.add(unit);
  const depth = Math.max(-1, ...[...unit.deps].map((dep) => depthOf(dep, memo, seen))) + 1;
  memo.set(unit, depth);
  return depth;
}

/** What a plan saw of one PRD. */
function seenOf(input: PrdInput): Seen {
  const slices = input.slices === null ? null : input.slices.map((slice) => slice.id).sort();
  const stuck = (input.slices ?? []).filter((slice) => slice.state === 'stuck').map((slice) => slice.id).sort();
  return { prd: input.prd, slices, stuck, ended: input.ended };
}

/** The loop plan of `inputs`, numbered `version` and carrying `reason` (none for version 1). */
export function planLoop(inputs: PlanInputs, { version = 1, reason = null }: { version?: number; reason?: string | null } = {}): LoopPlan {
  const ordered = prdOrder(inputs.prds);
  const unitsByPrd = new Map(ordered.map((input, order) => [input.prd, unitsOf(input, order)] as const));
  const units = [...unitsByPrd.values()].flat();
  orderCollisions(units);
  orderBlockers(ordered, unitsByPrd, new Set(inputs.shipped));

  const memo = new Map<Unit, number>();
  const depth = new Map(units.map((unit) => [unit, depthOf(unit, memo)] as const));
  const level = (unit: Unit): number => depth.get(unit) ?? 0;
  const sorted = [...units].sort((a, b) => level(a) - level(b) || a.order - b.order || a.index - b.index);
  const numberOf = new Map(sorted.map((unit, index) => [unit, index + 1] as const));
  const num = (unit: Unit): number => numberOf.get(unit) ?? 0;

  const steps = sorted.map(
    (unit): Step => ({
      step: num(unit),
      prd: unit.prd,
      kind: unit.kind,
      wave: unit.wave,
      slices: unit.slices.map((slice) => slice.id),
      after: [...unit.deps].map(num).sort(byNumber),
      waitsFor: unit.waitsFor,
      why: unit.why,
      beside: sorted.filter((other) => other !== unit && level(other) === level(unit)).map(num),
    }),
  );
  return { version, reason, prds: ordered.map((input) => input.prd).sort(byNumber), steps, seen: [...inputs.prds].sort((a, b) => a.prd - b.prd).map(seenOf) };
}

/** Every order the plan sets between PRDs, one line each: `step 3: 1030 s3 after 1017 s2: …`. */
export function crossOrders(plan: LoopPlan): string[] {
  return plan.steps.flatMap((step) => step.why.map((why) => `step ${step.step}: ${why}`));
}
