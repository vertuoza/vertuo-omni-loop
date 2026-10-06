// The game room's registry: every arcade game, in the order its cabinets stand. Each later game's PRD
// adds its row here, and its unlock level to the rulebook's `xp.unlocks` (game/rulebook.ts).
import type { SceneName } from '../scenes/common.ts';

export interface Game {
  /** Its key in the rulebook's `xp.unlocks` and in player_xp.unlocked. */
  id: string;
  /** The name on its cabinet's marquee. */
  title: string;
  /** The scene A opens on its unlocked cabinet; null until the game is playable. */
  scene: SceneName | null;
}

export const GAMES: readonly Game[] = [
  { id: 'invaders', title: 'ENTROPY INVADERS', scene: 'invaders' },
  { id: 'platformer', title: 'SUPER OMNI WORLD', scene: 'platformer' },
];
