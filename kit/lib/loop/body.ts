// PRD 1139, slice s4: the bodies `omni loop push` sends to `POST <ask.url>/api/loops`, one per event,
// in the shape the app's contract takes (`apps/galaxy/src/loop/api.ts`, which refuses an unknown field):
//
//   start {event, repo, prds, plan, reason?, takeOver}
//   tick  {event, loopId, step, steps, prd, action, result, link, merged, items, nextWakeAt, replan?}
//   park  {event, loopId, prd, who, what, link}
//   stop  {event, loopId}
//
// The plan is the loop plan `omni next --plan` keeps (`../next/store.ts`), sent whole: the app stores
// and shows it, never reshapes it. Pure: the command reads the files and the flags, this shapes them.
// Each line of text is put on one line and cut to the contract's length, so a long result never turns
// a tick into a refusal.
import type { OutboxItemId, PrdNumber, PrNumber } from '../ids.ts';
import type { LoopPlan } from '../next/plan.ts';

/** The longest `result`, `what` and replan reason the contract takes. */
export const LINE_MAX = 300;
/** The longest `who` the contract takes. */
export const WHO_MAX = 100;

export type StartBody = { event: 'start'; repo: string; prds: PrdNumber[]; plan: LoopPlan; reason?: string; takeOver: boolean };
export type TickBody = {
  event: 'tick'; loopId: string; step: number; steps: number; prd: PrdNumber; action: string; result: string;
  link: string | null; merged: PrNumber[]; items: OutboxItemId[]; nextWakeAt: string | null;
  replan?: { reason: string; plan: LoopPlan };
};
export type ParkBody = { event: 'park'; loopId: string; prd: PrdNumber; who: string; what: string; link: string | null };
export type StopBody = { event: 'stop'; loopId: string };
export type LoopBody = StartBody | TickBody | ParkBody | StopBody;

/** `text` on one line, cut to `max` characters. */
export function oneLine(text: string, max: number): string {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, max).join('').trim();
}

/** Why a plan version was written, as the contract takes it: its own reason, else its number. */
const reasonOf = (plan: LoopPlan): string => oneLine(plan.reason ?? '', LINE_MAX) || `plan v${plan.version}`;

/** A loop opens on `repo`, driving the plan's PRDs on the plan; `takeOver` stops a silent one first. */
export function startBody({ repo, plan, takeOver }: { repo: string; plan: LoopPlan; takeOver: boolean }): StartBody {
  const reason = oneLine(plan.reason ?? '', LINE_MAX);
  return { event: 'start', repo, prds: [...plan.prds], plan, ...(reason ? { reason } : {}), takeOver };
}

/** One tick of loop `loopId`. `replan`, when given, is a plan version the app has not seen yet. */
export function tickBody({ loopId, step, steps, prd, action, result, link = null, merged = [], items = [], nextWakeAt = null, replan = null }: {
  loopId: string; step: number; steps: number; prd: PrdNumber; action: string; result: string;
  link?: string | null; merged?: readonly PrNumber[]; items?: readonly OutboxItemId[]; nextWakeAt?: string | null; replan?: LoopPlan | null;
}): TickBody {
  return {
    event: 'tick', loopId, step, steps, prd, action, result: oneLine(result, LINE_MAX), link,
    merged: [...merged], items: [...items], nextWakeAt,
    ...(replan ? { replan: { reason: reasonOf(replan), plan: replan } } : {}),
  };
}

/** PRD `prd` of loop `loopId` waits on `who`, for `what`. */
export function parkBody({ loopId, prd, who, what, link = null }: { loopId: string; prd: PrdNumber; who: string; what: string; link?: string | null }): ParkBody {
  return { event: 'park', loopId, prd, who: oneLine(who, WHO_MAX), what: oneLine(what, LINE_MAX), link };
}

/** Loop `loopId` ends. */
export function stopBody(loopId: string): StopBody {
  return { event: 'stop', loopId };
}
