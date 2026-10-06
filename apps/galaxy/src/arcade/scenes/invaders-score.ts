// A game's score at its end (Entropy Invaders' game over; Super Omni World's game over or WORLD
// CLEAR, PRD 817), as pure functions: sent once, with one retry on A when that fails; NEW BEST when
// it is one; and the crew's table it changes, which the cabinet's top five and the HI on the score
// line show. The sending itself is the account's (Account.submitScore(), through submitSend()).
import { TOP } from '../../data/scores';
import type { Action } from '../keys';
import type { ScoreLine, ScoresRead } from '../types';

/** Where the game over's score is: being sent, saved (with the best as stored), or not saved. */
export type ScoreSend =
  | { state: 'sending'; score: number; tries: number }
  | { state: 'saved'; score: number; best: number; newBest: boolean }
  | { state: 'failed'; score: number; tries: number };

/** A score is sent at game over, and once more when A retries a send that failed: never more. */
export const SEND_TRIES = 2;

export const sending = (score: number, tries = 1): ScoreSend => ({ state: 'sending', score, tries });

/** NEW BEST: the score is now the stored best, and higher than the player's best before it (none counts as 0). */
export const isNewBest = (score: number, best: number, before: number | null): boolean => best === score && score > (before ?? 0);

/** The send came back with the player's best as stored; `before` is the best the arcade knew of theirs. */
export function saved(send: ScoreSend, best: number, before: number | null): ScoreSend {
  return { state: 'saved', score: send.score, best, newBest: isNewBest(send.score, best, before) };
}

export function failed(send: ScoreSend): ScoreSend {
  return { state: 'failed', score: send.score, tries: send.state === 'saved' ? SEND_TRIES : send.tries };
}

/** True when the score is not saved and A may still try once more. */
/** The tone of the end screen's line on its score: NEW BEST, or the send's state. */
export const sendTone = (send: ScoreSend): string => (send.state === 'saved' && send.newBest ? 'best' : send.state);

export const canRetry = (s: ScoreSend | null): boolean => s?.state === 'failed' && s.tries < SEND_TRIES;

/**
 * What a press does at game over, once its score has shown: A retries a send that failed while a
 * retry is left; any other press is the game's own (A, B or START go back to the game room).
 */
export function overPress(send: ScoreSend | null, action: Action): 'retry' | 'game' {
  return action === 'a' && canRetry(send) ? 'retry' : 'game';
}

/**
 * The crew's table once the player's best is stored: their line replaced (or added) and the table
 * sorted best first, an equal score already there staying ahead, five lines kept. A best no higher
 * than the one the table knew changes nothing; a table out of reach stays so.
 */
export function withBest(board: ScoresRead | undefined, line: ScoreLine): ScoresRead {
  if (board === 'unreadable') return board;
  if (board && board.mine !== null && line.best <= board.mine) return board;
  const others = board ? board.top.filter((l) => l.id !== line.id) : [];
  return { top: [...others, line].sort((a, b) => b.best - a.best).slice(0, TOP), mine: line.best };
}

/** The HI on the score line: the crew's best, none before any score or when the table is out of reach. */
export function hiOf(board: ScoresRead | undefined): ScoreLine | null {
  return board && board !== 'unreadable' ? board.top[0] ?? null : null;
}

/** A best as the send's line shows it: its digits in groups of three, `9 210` (the crew table's way). */
const bestDigits = (n: number) => String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** The end screen's line on its score: being saved, NEW BEST or the player's best, or not saved. */
export function sendLine(send: ScoreSend | null): string | null {
  if (!send) return null;
  if (send.state === 'sending') return 'SAVING SCORE…';
  if (send.state === 'failed') return 'SCORE NOT SAVED';
  return send.newBest ? 'NEW BEST' : `YOUR BEST ${bestDigits(send.best)}`;
}

/**
 * Sends one attempt of a game's score through the account, under the game's key (`invaders`,
 * `platformer`): what the end screen shows once it answers, and the best the account stored, none
 * when the send failed. `before` is the player's best the arcade knew of, for NEW BEST.
 */
export async function submitSend(
  account: { submitScore(game: string, score: number): Promise<number> },
  game: string,
  attempt: ScoreSend,
  before: number | null,
): Promise<{ send: ScoreSend; best: number | null }> {
  try {
    const best = await account.submitScore(game, attempt.score);
    return { send: saved(attempt, best, before), best };
  } catch (err) {
    console.error(err);
    return { send: failed(attempt), best: null };
  }
}
