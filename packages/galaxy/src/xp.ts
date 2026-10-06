// XP for the arcade: the rules and the functions of game/experience.ts, re-exported so the arcade
// applies them from the same place as `pnpm game:xp`, and the demo guest's borrowed XP.
import { RULEBOOK } from 'vertuo-omni-plan/game/rulebook.ts';
import { playerXp, type PlayerXp, type XpRules } from 'vertuo-omni-plan/game/experience.ts';
import type { GameEvent } from 'vertuo-omni-plan/game/events.ts';

export { experience, levelFor, playerXp, unlockedFor, xpForLevel } from 'vertuo-omni-plan/game/experience.ts';

/** The rulebook's `xp` block: the weights, the curve, the cap and the level each game unlocks at. */
export const XP_RULES: XpRules = RULEBOOK.xp;

/**
 * What the demo guest shows: the XP, level and unlocked games of the world's highest-XP contributor
 * (the first by login on a tie), or null when nobody in it earned XP. The demo and the single-file
 * artifact have no player_xp row, so the guest borrows one, and the game room shows lit.
 */
export function borrowedXp(events: readonly GameEvent[], { now, rules = RULEBOOK.xp }: { now: Date; rules?: XpRules }): PlayerXp | null {
  let best: PlayerXp | null = null;
  for (const row of playerXp(events, { now, rules })) if (row.xp > 0 && (!best || row.xp > best.xp)) best = row;
  return best;
}
