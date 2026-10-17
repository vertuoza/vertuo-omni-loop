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
  /** The crew boards its times or scores go to, named when a game has more than one (OMNI KART, PRD 1923); none means one board, under `id`. */
  boards?: readonly Board[];
}

/** A crew board of a game: its key in `arcade_scores.game`, and the name it shows. */
export interface Board {
  id: string;
  title: string;
}

export const GAMES: readonly Game[] = [
  { id: 'invaders', title: 'ENTROPY INVADERS', scene: 'invaders', measure: 'points' },
  { id: 'platformer', title: 'SUPER OMNI WORLD', scene: 'platformer', measure: 'points' },
  { id: 'kart', title: 'OMNI KART', scene: 'kart', measure: 'time', boards: [{ id: 'kart', title: 'COMET RING' }, { id: 'kart-frost-eight', title: 'FROST EIGHT' }] },
  { id: 'duet', title: 'OMNI DUET', scene: 'duet', measure: 'points' },
  { id: 'pong', title: 'OMNI PONG', scene: 'pong', measure: 'points' },
];

/** The ids of a game's boards: the ones it names, else its own id. */
export const boardIds = (game: Pick<Game, 'id' | 'boards'>): string[] => game.boards?.map((b) => b.id) ?? [game.id];

/** Every board of the registry, with the game it belongs to. */
export const BOARDS: readonly { id: string; game: Game }[] = GAMES.flatMap((game) => boardIds(game).map((id) => ({ id, game })));
