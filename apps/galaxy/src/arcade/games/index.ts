// The game room's registry: every arcade game, in the order its cabinets stand. Each later game's PRD
// adds its row here, and its unlock level to the rulebook's `xp.unlocks` (game/rulebook.ts).
import type { SceneName } from '../scenes/common.ts';

/** How a game's best is compared: `points`, the highest wins; `time`, the lowest wins (measure.ts). */
export type Measure = 'points' | 'time';

export interface Game {
  /** Its key in the rulebook's `xp.unlocks` and in player_xp.unlocked. */
  id: string;
  /** The name on its cabinet's marquee. */
  title: string;
  /** The scene A opens on its unlocked cabinet; null until the game is playable. */
  scene: SceneName | null;
  /** Which way its best goes; the SQL list of lowest-wins games in submit_score() must match (measure.guard.test.ts). */
  measure: Measure;
}

export const GAMES: readonly Game[] = [
  { id: 'invaders', title: 'ENTROPY INVADERS', scene: 'invaders', measure: 'points' },
  { id: 'platformer', title: 'SUPER OMNI WORLD', scene: 'platformer', measure: 'points' },
  { id: 'kart', title: 'OMNI KART', scene: 'kart', measure: 'time' },
];
