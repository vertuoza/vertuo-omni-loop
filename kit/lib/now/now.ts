// What a Claude session is on now (PRD 1208's spec, "omni now"): pure. The one reading that the
// status line, the `omni-hud` band and any other agent draw from. `read.ts` gathers the facts; this
// module turns them into the answer and its plain lines.
//
// - **The answer** is `{ headline, work, doing }`. `headline` is a running loop or the roadmap it
//   drives (none yet: a later slice reads it); `work` is what the session is on, or `null`; `doing`
//   is one line, or `null`.
// - **A PRD's work** is `{ kind: 'prd', number, topic, stage, slices, links }`. Its stage is PRD
//   324's (`in review`, `inbox`, `outbox`, `shipped`), worded `building` instead of `outbox` while a
//   slice of its cached board is not merged; a board with no slice, or none at all, leaves it as PRD
//   324 says. Its slices are those of the board in flight (`in-flight`, `claimed-stale`) or `stuck`,
//   in the board's order, each `{ id, name, state }` with `name` `null` when the board keeps none.
//   Its links are none yet: a later slice reads them.
// - **Doing**, for a PRD with slices in flight: `building <id> <name>, <id> <name>`; else `null`.
// - **The plain lines**: the work (`PRD <n> <topic> · <stage>`), then, when there is one, a line of
//   what it is doing and what is stuck (`building s3 tabs · stuck s5`). The session on nothing prints
//   the status line's own no-PRD line.
import type { PrdNumber } from '../ids.ts';
import type { NamedSlice } from '../statusline/board-cache.ts';
import { IN_FLIGHT, MERGED, OUTBOX, STUCK } from '../statusline/stage.ts';
import type { PrdStage } from '../statusline/stage.ts';

const BUILDING = 'building';

/** A PRD's stage as `omni now` words it. */
export type WorkStage = PrdStage | typeof BUILDING;

/** A link of what the session is on. */
export type NowLink = { label: string; href: string };

/** A slice being built, or stuck. */
export type NowSlice = { id: string; name: string | null; state: string };

/** What the session works on. */
export type NowWork = { kind: 'prd'; number: PrdNumber; topic: string; stage: WorkStage | null; slices: NowSlice[]; links: NowLink[] };

/** The loop, or the roadmap it drives, above the work. */
export type NowHeadline = { kind: 'loop' | 'roadmap'; number?: number; progress?: string; links: NowLink[] };

/** `omni now`'s answer. */
export type Now = { headline: NowHeadline | null; work: NowWork | null; doing: string | null };

/** The answer for a session on nothing. */
export const NOTHING: Now = Object.freeze({ headline: null, work: null, doing: null });

const NO_WORK_LINE = 'no PRD · /omni:brainstorm to start';
const SEPARATOR = ' · ';

/** The stage of a PRD whose PRD 324 stage is `stage`, with the slices of its cached board. */
export function workStage(stage: PrdStage | null, slices: readonly NamedSlice[] | null): WorkStage | null {
  if (stage !== OUTBOX || !slices || slices.length === 0) return stage;
  return slices.every((slice) => slice.state === MERGED) ? OUTBOX : BUILDING;
}

const inFlight = (slice: NowSlice): boolean => IN_FLIGHT.includes(slice.state);
const label = ({ id, name }: NowSlice): string => (name ? `${id} ${name}` : id);

/** The answer for a session on PRD `number` (`topic`), at PRD 324's `stage`, with its cached board's `slices`. */
export function nowOfPrd({ number, topic, stage, slices }: { number: PrdNumber; topic: string; stage: PrdStage | null; slices: readonly NamedSlice[] | null }): Now {
  const shown = (slices ?? [])
    .filter((slice) => IN_FLIGHT.includes(slice.state) || slice.state === STUCK)
    .map(({ id, name, state }) => ({ id, name: name ?? null, state }));
  const building = shown.filter(inFlight);
  return {
    headline: null,
    work: { kind: 'prd', number, topic, stage: workStage(stage, slices), slices: shown, links: [] },
    doing: building.length > 0 ? `${BUILDING} ${building.map(label).join(', ')}` : null,
  };
}

/** The answer as plain lines. */
export function nowLines({ work, doing }: Now): string[] {
  if (!work) return [NO_WORK_LINE];
  const head = [`PRD ${work.number} ${work.topic}`, ...(work.stage ? [work.stage] : [])].join(SEPARATOR);
  const stuck = work.slices.filter((slice) => slice.state === STUCK);
  const status = [...(doing ? [doing] : []), ...(stuck.length > 0 ? [`stuck ${stuck.map(label).join(', ')}`] : [])];
  return status.length > 0 ? [head, status.join(SEPARATOR)] : [head];
}
