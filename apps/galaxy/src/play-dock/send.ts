// A finished game's score, sent from the play dock exactly as the arcade sends it: once at game over,
// through the account's submitScore() under the game's key, and shown as the arcade shows it (being
// saved, NEW BEST, the player's best, or not saved), with the arcade's own pure steps
// (scenes/invaders-score.ts). The dock only calls them.
import { failed, saved, sending, type ScoreSend } from '../arcade/scenes/invaders-score';
import type { Account } from '../arcade/types';

/** The part of the arcade's account the dock uses: none (no way to save) leaves the score not saved. */
export type DockAccount = Pick<Account, 'submitScore'>;

/**
 * Sends `score` under `game`, the room's key for the game played, and reports each state it passes through: sending at once, then saved or failed.
 * `before` is the player's best the dock knew of, for NEW BEST. Never throws.
 */
export async function sendScore(account: DockAccount | null, game: string, score: number, show: (s: ScoreSend) => void, before: number | null = null, tries = 1): Promise<ScoreSend> {
  const attempt = sending(score, tries);
  show(attempt);
  let done: ScoreSend;
  try {
    if (!account) throw new Error('No account to save the score with.');
    done = saved(attempt, await account.submitScore(game, score), before);
  } catch (err) {
    console.error(err);
    done = failed(attempt);
  }
  show(done);
  return done;
}
