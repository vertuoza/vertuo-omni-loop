// PRD 1118: what a care round reads of one target of a plan repository's board. A target PR's claims
// and landing chain are that target's own: a wave building in the back-end holds the back-end's pull
// requests alone, and a target's chain is its own landings, numbered within it. Pure: the board's
// rows in, the target's share out; `kit/bin/commands/care.ts` reads the board.
import type { LandingRow } from '../board.ts';

// The board states that mean a wave still holds a claim on the feature branch: an open sub-PR.
const CLAIM_STATES = new Set(['in-flight', 'claimed-stale']);

/** The ids of the slices a wave holds claims on: among the target `repo`'s own slices, or every
 * slice for `null` (a one-repository board, or the plan PR). */
export function claimedIn(rows: readonly { id: string; state: string; repo?: string | null }[], repo: string | null): string[] {
  return rows.filter((row) => CLAIM_STATES.has(row.state) && (repo === null || row.repo === repo)).map((row) => row.id);
}

/** The landings of the target `repo`'s own chain, in order. */
export function landingsIn(rows: readonly LandingRow[], repo: string): LandingRow[] {
  return rows.filter((row) => row.repo === repo);
}
