// Dropping a PRD from a mission's branch (PRD 2896 s7, spec "4. Keeping up, landing, dropping", criterion 11). Pure: what a drop
// takes off the branch, what asks for it, and the line that says how. `omni mission drop` and the App's job read the same words.
//
//   the set      the PRD, and, unless `--keep`, every PRD that joined after it and shares its territory (its plan's slices'
//                paths, `sharedGround`), or shares one with a PRD dropped before it: a later PRD built on the dropped one's ground
//                cannot stay on a branch that no longer holds it. A PRD whose territory is not known shares nothing
//   the ask      a member's request, kept as an event of the mission (`drop-asked`, `drop-asked-keep` for `--keep`); it stands
//                until the PRD leaves the branch, or joins it again
import type { PrdNumber } from '../ids.ts';
import { parsePlanSlices, sharedGround } from '../inbox/territory.ts';

/** Every path a plan's slices declare, once each; null when there is no plan, or none the parser reads. */
export function territoryOf(plan: string | null): string[] | null {
  if (plan === null) return null;
  try {
    const paths = [...new Set(parsePlanSlices(plan).flatMap((slice) => slice.territory))];
    return paths.length > 0 ? paths : null;
  } catch {
    return null;
  }
}

/** The events a member's ask is recorded as. */
export const DROP_ASKED = 'drop-asked';
export const DROP_ASKED_KEEP = 'drop-asked-keep';

/** What a drop takes off the branch: the PRD asked for, the later PRDs that share its territory, and every PRD that leaves (all in join order). */
export type DropSet = { prd: PrdNumber; sharing: PrdNumber[]; dropped: PrdNumber[] };

/**
 * What dropping `prd` takes off a branch holding `order` (the PRDs on it, in the order they joined). `territory` is each PRD's
 * plan territory, null when unknown. `keep`: the PRDs sharing its territory stay, though they are still named. Null when `prd`
 * is not on the branch.
 */
export function dropSet({
  order,
  prd,
  keep,
  territory,
}: {
  order: readonly PrdNumber[];
  prd: PrdNumber;
  keep: boolean;
  territory: (prd: PrdNumber) => readonly string[] | null;
}): DropSet | null {
  const at = order.indexOf(prd);
  if (at < 0) return null;
  const sharing: PrdNumber[] = [];
  const ground: (readonly string[])[] = [];
  const first = territory(prd);
  if (first !== null) ground.push(first);
  for (const later of order.slice(at + 1)) {
    const mine = territory(later);
    if (mine === null || !ground.some((other) => sharedGround({ territory: [...other] }, { territory: [...mine] }).length > 0)) continue;
    sharing.push(later);
    ground.push(mine);
  }
  return { prd, sharing, dropped: keep ? [prd] : [prd, ...sharing] };
}

/** A member's ask that is still standing: the PRD, and whether the later PRDs sharing its territory stay. */
export type DropAsk = { prd: PrdNumber; keep: boolean };

/**
 * The asks still standing, from a mission's events in the order they happened: an ask stands while its PRD is on the branch
 * and left it by no drop since; a PRD that is not on the branch when asked has nothing to drop, and the ask is void.
 */
export function standingAsks(events: readonly { kind: string; prd: PrdNumber | null }[]): DropAsk[] {
  const on = new Set<PrdNumber>();
  const asks = new Map<PrdNumber, boolean>();
  for (const { kind, prd } of events) {
    if (prd === null) continue;
    if (kind === 'prd-joined') {
      on.add(prd);
      asks.delete(prd);
    } else if (kind === DROP_ASKED || kind === DROP_ASKED_KEEP) {
      if (on.has(prd)) asks.set(prd, kind === DROP_ASKED_KEEP);
    } else if (kind === 'prd-dropped' || kind === 'landed' || kind === 'prd-merged') {
      on.delete(prd);
      asks.delete(prd);
    }
  }
  return [...asks].map(([prd, keep]) => ({ prd, keep }));
}

/** The PRDs a drop left off the branch, until a person sends them again: the latest of a PRD's joins and drops is a drop. */
export function droppedOf(events: readonly { kind: string; prd: PrdNumber | null }[]): Set<PrdNumber> {
  const dropped = new Set<PrdNumber>();
  for (const { kind, prd } of events) {
    if (prd === null) continue;
    if (kind === 'prd-dropped') dropped.add(prd);
    else if (kind === 'prd-joined' || kind === 'prd-merged' || kind === 'landed') dropped.delete(prd);
  }
  return dropped;
}

/** The command a person runs to drop PRD `prd` from mission `mission`'s branch. */
export const dropLine = (mission: number, prd: PrdNumber): string => `omni mission drop ${String(mission)} ${String(prd)}`;

const prds = (list: readonly PrdNumber[]): string => list.map((one) => `PRD ${String(one)}`).join(', ');

/** What `omni mission drop` tells the person: what leaves `branch`, and what stays though it shares the territory. */
export function dropWords({ branch, set, keep }: { branch: string; set: DropSet; keep: boolean }): string[] {
  const drops = `PRD ${String(set.prd)} will be dropped from ${branch}: its commit leaves the branch on the mission's next run, its feature pull request is reopened, and the default branch is never changed.`;
  if (set.sharing.length === 0) return [drops, 'No later PRD on the branch shares its territory.'];
  return keep
    ? [drops, `Later PRDs sharing its territory, kept on the branch (--keep): ${prds(set.sharing)}.`]
    : [drops, `Later PRDs sharing its territory, dropped with it: ${prds(set.sharing)}. Pass --keep to leave them on the branch.`];
}
