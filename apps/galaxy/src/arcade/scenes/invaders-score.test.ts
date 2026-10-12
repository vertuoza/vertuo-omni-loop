import { describe, expect, it, vi } from 'vitest';
import type { ScoreBoard, ScoreLine, ScoresRead } from '../types';
import { canRetry, failed, hiOf, isNewBest, overPress, saved, SEND_TRIES, sending, sendLine, submitSend, withBest, type ScoreSend } from './invaders-score';

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

describe('sending a game\'s score through the account (PRD 817)', () => {
  /** An account that answers the send with the best it stores, or refuses it; it records each call. */
  const fakeAccount = (best: number | Error) => {
    const calls: [string, number][] = [];
    return {
      calls,
      submitScore: (game: string, score: number) => {
        calls.push([game, score]);
        return best instanceof Error ? Promise.reject(best) : Promise.resolve(best);
      },
    };
  };

  it('sends the score once under the game\'s key, and says NEW BEST when it is one', async () => {
    const account = fakeAccount(4200);
    const done = await submitSend(account, 'platformer', sending(4200), 3000);
    expect(account.calls).toEqual([['platformer', 4200]]);
    expect(done).toEqual({ send: { state: 'saved', score: 4200, best: 4200, newBest: true }, best: 4200 });
  });

  it('says the player\'s best when the score is not a new one', async () => {
    const done = await submitSend(fakeAccount(9000), 'platformer', sending(4200), 9000);
    expect(done.send).toEqual({ state: 'saved', score: 4200, best: 9000, newBest: false });
    expect(sendLine(done.send)).toBe('YOUR BEST 9 000');
  });

  it('says not saved when the account refuses, and leaves A its retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const done = await submitSend(fakeAccount(new Error('offline')), 'platformer', sending(4200), null);
    expect(done).toEqual({ send: { state: 'failed', score: 4200, tries: 1 }, best: null });
    expect(canRetry(done.send)).toBe(true);
    const again = await submitSend(fakeAccount(new Error('offline')), 'platformer', sending(4200, 2), null);
    expect(canRetry(again.send)).toBe(false);
  });

  it('names each state of the send in a line: saving, NEW BEST, the best, or not saved', () => {
    expect(sendLine(null)).toBeNull();
    expect(sendLine(sending(10))).toBe('SAVING SCORE…');
    expect(sendLine({ state: 'saved', score: 10, best: 10, newBest: true })).toBe('NEW BEST');
    expect(sendLine({ state: 'saved', score: 10, best: 1240, newBest: false })).toBe('YOUR BEST 1 240');
    expect(sendLine({ state: 'failed', score: 10, tries: 1 })).toBe('SCORE NOT SAVED');
  });
});

describe('a time game (OMNI KART): the lowest wins', () => {
  it('names a NEW BEST for the first time, then only a faster one', () => {
    expect(isNewBest(1023, 1023, null, 'time')).toBe(true);
    expect(isNewBest(0, 0, null, 'time')).toBe(true);
    expect(isNewBest(1023, 1023, 1100, 'time')).toBe(true);
    expect(isNewBest(1200, 1100, 1100, 'time')).toBe(false);
    expect(isNewBest(1100, 1100, 1100, 'time')).toBe(false);
    expect(saved(sending(1023), 1023, 1100, 'time')).toMatchObject({ newBest: true });
    expect(saved(sending(1300), 1100, 1100, 'time')).toMatchObject({ best: 1100, newBest: false });
  });

  it('keeps the table fastest first and five long, and a slower time changes nothing', () => {
    const top = board(1500, line('a', 1000), line('b', 1100), line('c', 1200), line('me', 1500), line('d', 1600));
    expect(ids(withBest(top, line('me', 1050), 'time'))).toEqual(['a', 'me', 'b', 'c', 'd']);
    expect(mineOf(withBest(top, line('me', 1050), 'time'))).toBe(1050);
    expect(withBest(top, line('me', 1700), 'time')).toBe(top);
    expect(withBest(top, line('me', 1500), 'time')).toBe(top);
    const full = board(null, line('a', 1000), line('b', 1100), line('c', 1200), line('d', 1300), line('e', 1400));
    expect(ids(withBest(full, line('me', 1250), 'time'))).toEqual(['a', 'b', 'c', 'me', 'd']);
    expect(ids(withBest(full, line('me', 2000), 'time'))).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(withBest(board(null), line('me', 900), 'time')).toEqual(board(900, line('me', 900)));
  });

  it('words its end line for a time, and a game\'s send reads its measure from its id', async () => {
    expect(sendLine(sending(1023), 'time')).toBe('SAVING TIME…');
    expect(sendLine({ state: 'failed', score: 1023, tries: 1 }, 'time')).toBe('TIME NOT SAVED');
    expect(sendLine({ state: 'saved', score: 1300, best: 1023, newBest: false }, 'time')).toBe('YOUR BEST 1:42.3');
    expect(sendLine({ state: 'saved', score: 1023, best: 1023, newBest: true }, 'time')).toBe('NEW BEST');
    const account = { submitScore: () => Promise.resolve(1023) };
    expect((await submitSend(account, 'kart', sending(1023), 1100)).send).toMatchObject({ state: 'saved', newBest: true });
    expect((await submitSend({ submitScore: () => Promise.resolve(1100) }, 'kart', sending(1300), 1100)).send).toMatchObject({ newBest: false });
    expect((await submitSend({ submitScore: () => Promise.resolve(300) }, 'invaders', sending(300), 1100)).send).toMatchObject({ newBest: false });
  });
});
