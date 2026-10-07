// The Loop page's reads of a loop (PRD 1139 s5), pure, so the page is tested on demo data and rows:
//
// - readPlan: the plan `omni next --plan` pushed, which the app stores as it came (store.ts' LoopPlan),
//   read into its numbered steps. A step names its PRD and, when it builds one, its slice and wave;
//   `after` names the step it waits on and why (two PRDs touching the same ground run in series);
//   `beside` marks one the plan lets run beside another. A plan it cannot read is unreadable, never
//   guessed: the page says so and still shows the ledger.
// - timelineOf: those steps as one row per PRD, each step at its place on the plan, collisions
//   marked with their reason, the steps before the loop's current one done.
// - stateLineOf: live, sleeping, parked, stopped or silent (state.ts' loopState), as one line.
// - ledgerOf: the ticks and every replan after the first plan, the newest first, each tick linking to
//   its PRD's page.
import { z } from 'zod';
import { PrdNumberSchema, SliceIdSchema, type PrdNumber, type SliceId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { loopState, type LoopState, type LoopTimes } from '../state';
import type { LoopPlan } from '../store';

/** One step of a loop plan. */
export interface PlanStep {
  step: number;
  prd: PrdNumber;
  slice: SliceId | null;
  wave: number | null;
  /** What the step runs when it builds no slice (`pr-care`, `yolo`…), or null. */
  action: string | null;
  /** The step it runs after, and why: a collision between PRDs. */
  after: { prd: PrdNumber; slice: SliceId | null; reason: string } | null;
  /** The plan lets it run beside another step. */
  beside: boolean;
}

export type ReadPlan = { kind: 'steps'; steps: PlanStep[] } | { kind: 'unreadable' };

const Step = z.looseObject({
  step: z.number().int().min(1),
  prd: PrdNumberSchema,
  slice: SliceIdSchema.nullish(),
  wave: z.number().int().min(1).nullish(),
  action: z.string().min(1).max(40).nullish(),
  after: z.looseObject({ prd: PrdNumberSchema, slice: SliceIdSchema.nullish(), reason: z.string().min(1) }).nullish(),
  beside: z.union([z.boolean(), z.array(z.number())]).nullish(),
});
const Plan = z.looseObject({ steps: z.array(Step) });

/** The plan's steps, in their order; unreadable when it is not the shape the kit pushes. */
export function readPlan(plan: LoopPlan): ReadPlan {
  const parsed = Plan.safeParse(plan);
  if (!parsed.success) return { kind: 'unreadable' };
  const steps = parsed.data.steps.map((s): PlanStep => ({
    step: s.step,
    prd: s.prd,
    slice: s.slice ?? null,
    wave: s.wave ?? null,
    action: s.action ?? null,
    after: s.after ? { prd: s.after.prd, slice: s.after.slice ?? null, reason: s.after.reason } : null,
    beside: Array.isArray(s.beside) ? s.beside.length > 0 : s.beside === true,
  }));
  return { kind: 'steps', steps: steps.sort((a, b) => a.step - b.step) };
}

/** One step on a PRD's row of the timeline. */
export interface TimelineCell {
  step: number;
  label: string;
  /** `after PRD 1030 s3: both touch …`, or null. */
  collision: string | null;
  beside: boolean;
  done: boolean;
  current: boolean;
}

export interface TimelineRow {
  prd: PrdNumber;
  cells: TimelineCell[];
}

const named = (prd: PrdNumber, slice: SliceId | null) => (slice ? `PRD ${prd} ${slice}` : `PRD ${prd}`);

/** One row per PRD, in the order each first appears; `current` is the step the loop's last tick took. */
export function timelineOf(steps: readonly PlanStep[], current: number | null): TimelineRow[] {
  const rows = new Map<PrdNumber, TimelineCell[]>();
  for (const s of steps) {
    const cells = rows.get(s.prd) ?? [];
    cells.push({
      step: s.step,
      label: s.slice ?? s.action ?? `step ${s.step}`,
      collision: s.after ? `after ${named(s.after.prd, s.after.slice)}: ${s.after.reason}` : null,
      beside: s.beside,
      done: current !== null && s.step < current,
      current: s.step === current,
    });
    rows.set(s.prd, cells);
  }
  return [...rows].map(([prd, cells]) => ({ prd, cells }));
}

/** An instant as its UTC hour and minute, `14:32 UTC`; an unreadable one as —. */
export function clockOf(iso: string): string {
  const at = Date.parse(iso);
  return Number.isFinite(at) ? `${new Date(at).toISOString().slice(11, 16)} UTC` : '—';
}

/** A loop's state at `now`, and the line that names it. */
export function stateLineOf(loop: LoopTimes & { last_tick_at: string | null }, now: number): { state: LoopState; line: string } {
  const state = loopState(loop, now);
  if (state === 'sleeping' && loop.next_wake_at) return { state, line: `sleeping · wakes ${clockOf(loop.next_wake_at)}` };
  if (state === 'silent') {
    const last = Date.parse(loop.last_tick_at ?? loop.seen_at);
    const minutes = Number.isFinite(last) ? Math.max(0, Math.floor((now - last) / 60_000)) : null;
    return { state, line: minutes === null ? 'silent' : `silent · no tick for ${minutes} min` };
  }
  return { state, line: state };
}

/** A PRD's page in the app. */
export const prdHref = (prd: PrdNumber) => `/prd/${prd}`;

export type LedgerLine =
  | { kind: 'tick'; at: string; step: number; steps: number; prd: PrdNumber; href: string; action: string; result: string; merged: number; items: number }
  | { kind: 'replan'; at: string; version: number; reason: string };

type TickIn = { at: string; step: number; steps: number; prd: PrdNumber; action: string; result: string; merged: readonly unknown[]; items: readonly unknown[] };
type PlanIn = { version: number; reason: string; created_at: string };

/** The ticks and every plan version after the first, the newest first. */
export function ledgerOf(ticks: readonly TickIn[], plans: readonly PlanIn[]): LedgerLine[] {
  const lines: Array<{ time: number; order: number; line: LedgerLine }> = [
    ...ticks.map((t, i) => ({
      time: Date.parse(t.at), order: i,
      line: { kind: 'tick' as const, at: clockOf(t.at), step: t.step, steps: t.steps, prd: t.prd, href: prdHref(t.prd), action: t.action, result: t.result, merged: t.merged.length, items: t.items.length },
    })),
    ...plans.filter((p) => p.version > 1).map((p) => ({
      time: Date.parse(p.created_at), order: p.version,
      line: { kind: 'replan' as const, at: clockOf(p.created_at), version: p.version, reason: p.reason },
    })),
  ];
  const time = (t: number) => (Number.isFinite(t) ? t : 0);
  return lines.sort((a, b) => time(b.time) - time(a.time) || b.order - a.order).map((l) => l.line);
}
