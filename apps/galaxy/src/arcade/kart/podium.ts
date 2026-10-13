// OMNI KART's podium (PRD 1762), pure: the three steps and the player's place, read from the results.
import { ordinal } from '../fleets';
import type { KartPodium, KartResults, KartRow, KartStep } from '../scenes/kart.ts';

/** The order the steps stand in: second, first, third. */
const STANDING = [2, 1, 3] as const;

/** A step with nobody on it yet: `…`. */
const empty = (place: 1 | 2 | 3): KartStep => ({ place, name: '…', filled: false, tenths: null, you: false });

/**
 * The podium of a set of results: the places 2, 1 and 3 in that order, each with its driver and kart look. A player who is OUT
 * never stands on a step. In MULTI (`live` results) a step stays empty until its driver has crossed the line, then fills in;
 * in SINGLE the steps are the first three places. The player's place stands under the steps when they are not on them.
 */
export function podiumOf(results: KartResults): KartPodium {
  const standing: readonly KartRow[] = results.rows.filter((r) => !r.out);
  const step = (place: 1 | 2 | 3): KartStep => {
    const row = standing[place - 1];
    if (!row || (results.live && row.tenths === null)) return empty(place);
    return { place, name: row.name, filled: true, tenths: row.tenths, you: row.you, ...(row.tint !== undefined ? { tint: row.tint } : {}), ...(row.look ? { look: row.look } : {}) };
  };
  return { steps: STANDING.map(step), place: results.place > 3 ? `YOU ${ordinal(results.place)}` : null };
}
