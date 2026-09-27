import { describe, expect, it } from 'vitest';
import type { ScoreBoard, ScoreLine, ScoresRead } from '../types';
import { canRetry, failed, hiOf, isNewBest, overPress, saved, SEND_TRIES, sending, withBest, type ScoreSend } from './invaders-score';

const line = (id: string, best: number): ScoreLine => ({ id, name: id.toUpperCase(), hero: null, team: null, best });
const board = (mine: number | null, ...top: ScoreLine[]): ScoreBoard => ({ top, mine });
/** The ids down a table, best first; a table out of reach has none. */
const ids = (b: ScoresRead) => (b === 'unreadable' ? [] : b.top.map((l) => l.id));
const mineOf = (b: ScoresRead) => (b === 'unreadable' ? undefined : b.mine);

describe('sending the score at game over', () => {
  it('sends it once, then gives A one retry when that fails, and no more', () => {
    const first = sending(385);
    expect(first).toEqual({ state: 'sending', score: 385, tries: 1 });
    expect(canRetry(first)).toBe(false);
    const lost = failed(first);
    expect(lost).toEqual({ state: 'failed', score: 385, tries: 1 });
    expect(canRetry(lost)).toBe(true);
    const again = sending(385, 2);
    expect(canRetry(failed(again))).toBe(false);
    expect(SEND_TRIES).toBe(2);
  });

  it('is saved with the best as stored, and NEW BEST only when the score is it and beats the best before', () => {
    expect(saved(sending(385), 385, null)).toEqual({ state: 'saved', score: 385, best: 385, newBest: true });
    expect(saved(sending(385), 385, 200)).toMatchObject({ newBest: true });
    expect(saved(sending(385), 1240, 1240)).toMatchObject({ best: 1240, newBest: false });
    expect(saved(sending(385), 385, 385)).toMatchObject({ newBest: false }); // a tie is not a new best
  });

  it('never calls a first game of 0 a new best', () => {
    expect(isNewBest(0, 0, null)).toBe(false);
    expect(isNewBest(5, 5, null)).toBe(true);
  });
});

describe('a press at game over', () => {
  const lost: ScoreSend = { state: 'failed', score: 385, tries: 1 };

  it('A retries a send that failed, while its retry is left', () => {
    expect(overPress(lost, 'a')).toBe('retry');
    expect(overPress({ ...lost, tries: SEND_TRIES }, 'a')).toBe('game');
  });

  it('leaves every other press to the game: B and START go back to the room, and A too once the score is saved or sending', () => {
    for (const action of ['b', 'start', 'left', 'select'] as const) expect(overPress(lost, action)).toBe('game');
    expect(overPress(sending(385), 'a')).toBe('game');
    expect(overPress(saved(sending(385), 385, null), 'a')).toBe('game');
    expect(overPress(null, 'a')).toBe('game');
  });
});

describe('the crew table once a best is stored', () => {
  it('replaces the player\'s line, or adds it, best first, and keeps five', () => {
    const top = board(300, line('dime', 12480), line('inky', 9210), line('me', 300), line('bonny', 200), line('kraken', 100));
    expect(ids(withBest(top, line('me', 9500)))).toEqual(['dime', 'me', 'inky', 'bonny', 'kraken']);
    expect(mineOf(withBest(top, line('me', 9500)))).toBe(9500);
    const full = board(null, line('a', 500), line('b', 400), line('c', 300), line('d', 200), line('e', 100));
    expect(ids(withBest(full, line('me', 250)))).toEqual(['a', 'b', 'c', 'me', 'd']);
    expect(withBest(full, line('me', 50))).toEqual({ top: full.top, mine: 50 });
    expect(withBest(board(null), line('me', 40))).toEqual(board(40, line('me', 40)));
  });

  it('puts a new best after an equal one already there: the earlier comes first', () => {
    expect(ids(withBest(board(null, line('a', 500)), line('me', 500)))).toEqual(['a', 'me']);
  });

  it('changes nothing when the best stored is no higher than the one it knew', () => {
    const top = board(900, line('a', 1000), line('me', 900), line('b', 900));
    expect(withBest(top, line('me', 900))).toBe(top);
  });

  it('stays out of reach when it could not be read, and starts from nothing when there was none', () => {
    expect(withBest('unreadable', line('me', 40))).toBe('unreadable');
    expect(withBest(undefined, line('me', 40))).toEqual(board(40, line('me', 40)));
  });
});

describe('the HI on the score line', () => {
  it('is the crew\'s best: the top line of the table', () => {
    expect(hiOf(board(null, line('dime', 12480), line('inky', 9210)))).toEqual(line('dime', 12480));
  });

  it('is none before any score, and when the table could not be read', () => {
    expect(hiOf(board(null))).toBeNull();
    expect(hiOf('unreadable')).toBeNull();
    expect(hiOf(undefined)).toBeNull();
  });
});
