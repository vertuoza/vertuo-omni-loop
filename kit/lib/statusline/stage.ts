// @ts-nocheck
// Where one PRD stands (PRD 324's spec, "The stage"): pure. The rule of PRD #315, written for one PRD
// (the spec's D8), over what `facts.mjs` read from git as of the last fetch. The first row that
// matches:
//
// | stage       | rule                                                                              |
// | ----------- | --------------------------------------------------------------------------------- |
// | `shipped`   | its folder is in the delivery folder's `shipped/` on the base                     |
// | `outbox`    | its folder is in `inbox/` on the base, and its feature branch is built or holds   |
// |             | at least one open item, or its board shows a slice `merged`, `in-flight` or       |
// |             | `claimed-stale`                                                                   |
// | `inbox`     | its folder is in `inbox/` on the base, and it is not in the outbox                |
// | `in review` | its folder is on neither folder of the base                                       |
//
// With no base (neither the remote-tracking default branch nor the local one), there is no stage.
//
// - **Built:** some path outside the delivery folder changed on the feature branch since it forked
//   from the base (`<base>...<feature>`), and that path still differs from the base
//   (`<base> <feature>`). A phase-0 copy is byte-identical to the base once merged: never built.
// - **Open items:** the files under the PRD's outbox folder on the feature branch that
//   `outboxItemFiles` counts: `.md` files, not `settled.md`, nothing under `accounts/`.
// - A feature branch that does not exist is neither built nor holds items.
// - **The board** is the one the status line shows (`board-cache.mjs`: a cached board under 10 minutes
//   old). A board that sees a slice merged or in flight reads outbox before the feature branch is
//   built (the spec's D9): a wave's sub-PR shows on it the moment the wave claims its slice.
import { SETTLED_FILE } from '../outbox/outbox.ts';

export const SHIPPED = 'shipped';
export const OUTBOX = 'outbox';
export const INBOX = 'inbox';
export const IN_REVIEW = 'in review';

// A slice's states, as `boardFor` (`kit/lib/board.ts`) names them, that the status line reads.
export const MERGED = 'merged';
export const STUCK = 'stuck';
/** The states a slice is in flight in: its sub-PR open, its claim fresh or gone cold. */
export const IN_FLIGHT = Object.freeze(['in-flight', 'claimed-stale']);

const ACCOUNTS_DIR = 'accounts';

/** Whether `path` (relative to a PRD's outbox folder) is an open item, as `outboxItemFiles` counts one. */
export function isOpenItem(path) {
  const segments = String(path).split('/');
  const name = segments.pop();
  if (segments.includes(ACCOUNTS_DIR)) return false;
  return name.endsWith('.md') && name !== SETTLED_FILE;
}

/** How many of `paths` (relative to a PRD's outbox folder) are open items. */
export function openItemCount(paths) {
  return (paths ?? []).filter(isOpenItem).length;
}

/**
 * Whether a feature branch is built: a path outside `delivery` is in `forkChanges` (what changed
 * since the fork) and in `stillDiffers` (what differs from the base now).
 *
 * @param {{ forkChanges: string[], stillDiffers: string[], delivery: string }} changes
 */
export function isBuilt({ forkChanges, stillDiffers, delivery }) {
  const inside = `${String(delivery).replace(/\/+$/, '')}/`;
  const differs = new Set(stillDiffers ?? []);
  return (forkChanges ?? []).some((path) => !path.startsWith(inside) && differs.has(path));
}

/** Whether the board's `slices` show work under way: a slice merged or in flight. */
export function boardShowsWork(slices) {
  return (slices ?? []).some((slice) => slice.state === MERGED || IN_FLIGHT.includes(slice.state));
}

/** Whether a PRD whose folder is in the base inbox reads outbox: its feature branch is built, or
 * holds an open item, or its board shows a slice merged or in flight. */
export function inOutbox(feature, slices = null) {
  return Boolean(feature?.built) || (feature?.openItems ?? 0) > 0 || boardShowsWork(slices);
}

/**
 * The stage of the PRD whose folder is `folder`, or `null` without a base.
 *
 * @param {{ folder: string, base: { inbox: string[], shipped: string[] } | null,
 *   feature: { built: boolean, openItems: number } | null,
 *   slices?: { id: string, wave: number, state: string }[] | null }} facts the base's inbox and
 *   shipped folder names, what the feature branch holds (`null`: it was not read, or does not
 *   exist), and the slices of the board the status line shows (`null`: none)
 */
export function stageOf({ folder, base, feature, slices = null }) {
  if (!base) return null;
  if (base.shipped.includes(folder)) return SHIPPED;
  if (!base.inbox.includes(folder)) return IN_REVIEW;
  return inOutbox(feature, slices) ? OUTBOX : INBOX;
}
