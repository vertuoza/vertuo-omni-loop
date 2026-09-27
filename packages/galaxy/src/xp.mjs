// XP for the arcade: the rules and the functions of game/experience.mjs, re-exported so the arcade
// applies them from the same place as `pnpm game:xp`, and the demo guest's borrowed XP.
import { RULEBOOK } from 'vertuo-omni-plan/game/rulebook.mjs';
import { playerXp } from 'vertuo-omni-plan/game/experience.mjs';

export { experience, levelFor, playerXp, unlockedFor, xpForLevel } from 'vertuo-omni-plan/game/experience.mjs';

/** The rulebook's `xp` block: the weights, the curve, the cap and the level each game unlocks at. */
export const XP_RULES = RULEBOOK.xp;

/**
 * What the demo guest shows: the XP, level and unlocked games of the world's highest-XP contributor
 * (the first by login on a tie), or null when nobody in it earned XP. The demo and the single-file
 * artifact have no player_xp row, so the guest borrows one, and the game room shows lit.
 */
export function borrowedXp(events, { now, rules = RULEBOOK.xp }) {
  let best = null;
  for (const row of playerXp(events, { now, rules })) if (row.xp > 0 && (!best || row.xp > best.xp)) best = row;
  return best;
}
