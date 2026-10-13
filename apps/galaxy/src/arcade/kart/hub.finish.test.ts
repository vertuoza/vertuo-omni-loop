import { afterEach, describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import type { KartGame } from '../scenes/kart.ts';
import { sure } from '../test/sure';
import { createKart } from './art';
import { createHub } from './hub.fake';
import { openGrid, type GridSession, type RaceStart } from './hub';
import type { GridPlayer } from './net';
import { RULES } from './rules';

// A live race through the in-memory hub (PRD 1572, slice 4): two to four players start together from
// the same grid, each browser drives its own kart and sends its state at the send rate, the others
// are drawn from what they send, a player who leaves or goes silent is OUT, and a message of another
// race is ignored. No browser, no Supabase.

const hero = { v: 1, body: 'girl', skin: 0, hair: 0, suit: 0, cape: 0 } as const;
const who = (id: string, arrival: number, best: number | null = null): GridPlayer => ({ id, name: id, hero, fleet: null, best, arrival });
const NONE: ReadonlySet<Action> = new Set();

function table(ids: readonly string[], bests: Readonly<Record<string, number>> = {}) {
  const hub = createHub();
  const sessions = new Map<string, GridSession>();
  const games = new Map<string, KartGame>();
  const entered = new Map<string, RaceStart>();
  const people = new Map<string, GridPlayer>();
  const enter = (id: string, start: RaceStart) => {
    const me = sure(people.get(id), `player ${id}`);
    entered.set(id, start);
    games.set(id, createKart({ seed: start.seed, live: { session: sure(sessions.get(id), `session ${id}`), start, me } }));
  };
  ids.forEach((id, i) => {
    const me = who(id, i + 1, bests[id] ?? null);
    people.set(id, me);
    sessions.set(id, openGrid(hub.link(id), me, () => undefined, (start) => { enter(id, start); }));
  });
  /** The player who starts presses START RACE: they and everyone named in the start enter. */
  const go = (id = 'p0') => {
    const start = sure(sessions.get(id), id).start();
    if (start) enter(id, start);
    return start;
  };
  const game = (id: string) => sure(games.get(id), `game ${id}`);
  /** Plays `seconds` in 50 ms frames, every game stepped and the hub's time moving with them. */
  const play = (seconds: number, only: readonly string[] = [...games.keys()]) => {
    for (let t = 0; t < seconds - 1e-9; t += 0.05) {
      for (const id of only) game(id).step(NONE, 0.05);
      hub.advance(50);
    }
  };
  return { hub, sessions, games, entered, go, game, play, people };
}

const live: ReturnType<typeof table>[] = [];
const setup = (ids: readonly string[], bests: Readonly<Record<string, number>> = {}) => {
  const t = table(ids, bests);
  live.push(t);
  return t;
};
afterEach(() => {
  for (const t of live.splice(0)) {
    for (const g of t.games.values()) g.close();
    for (const s of t.sessions.values()) s.leave();
  }
});

// The finish and the results (PRD 1572, slice 5).
describe('the finish and the results', () => {
  /** Drives `id` round the circuit, holding A, until it crosses the line; the others stand and send their state. */
  const finish = (t: ReturnType<typeof table>, id: string) => {
    for (let i = 0; i < 6000 && t.game(id).hud().phase !== 'finish'; i += 1) {
      t.game(id).step(new Set<Action>(['a']), 0.05);
      for (const other of t.games.keys()) if (other !== id) t.game(other).step(NONE, 0.05);
      t.hub.advance(50);
    }
  };
  const rowsOf = (t: ReturnType<typeof table>, id: string) => sure(t.game(id).hud().results, 'results').rows.map((r) => [r.name, r.out ? 'OUT' : r.tenths === null ? null : 'time']);

  it('fills the results in live: a finisher by time, a player still racing without one, then it fills in', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.5);
    finish(t, 'p0');
    t.hub.advance(100);
    expect(rowsOf(t, 'p0')).toEqual([['YOU', 'time'], ['P1', null]]);
    finish(t, 'p1');
    t.play(0.2, ['p0']);
    expect(rowsOf(t, 'p0').map((r) => r[1])).toEqual(['time', 'time']);
    expect(t.game('p1').hud().results?.rows.map((r) => r.you)).toEqual([false, true]);
  });

  it('reads OUT for a player who left before the line, and for one gone silent', () => {
    const t = setup(['p0', 'p1', 'p2']);
    t.go();
    t.play(RULES.countdown + 0.5);
    t.game('p1').away();
    finish(t, 'p0');
    t.hub.advance(100);
    expect(rowsOf(t, 'p0')).toEqual([['YOU', 'time'], ['P2', null], ['P1', 'OUT']]);
    t.play(RULES.outAfter + 1, ['p0']);
    expect(rowsOf(t, 'p0')).toEqual([['YOU', 'time'], ['P1', 'OUT'], ['P2', 'OUT']]);
  });

  it('keeps a player who finished off the OUT list however long they stay silent', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.5);
    finish(t, 'p1');
    finish(t, 'p0');
    t.play(RULES.outAfter + 2, ['p0']);
    expect(rowsOf(t, 'p0').map((r) => r[1])).toEqual(['time', 'time']);
  });

  it('A goes back to the grid, which cannot start a race while a player of the last one still races', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.5);
    finish(t, 'p0');
    expect(t.game('p0').press('a')).toEqual({ quit: false, again: false, grid: false }); // A on the podium shows the results
    expect(t.game('p0').press('a')).toEqual({ quit: false, again: false, grid: true });
    t.hub.advance(100);
    const grid = sure(t.sessions.get('p0'), 'session');
    expect(grid.view().line).toBe('RACE ON · 1 RACERS');
    expect(grid.start()).toBeNull();
    finish(t, 'p1');
    t.hub.advance(100);
    expect(grid.view().line).toBe('START RACE');
    expect(grid.start()).not.toBeNull();
  });

  it('lets the grid start again once the last race is left', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.5);
    finish(t, 'p0');
    const grid = sure(t.sessions.get('p0'), 'session');
    expect(grid.start()).toBeNull();
    t.game('p1').away();
    t.hub.advance(100);
    expect(grid.start()).not.toBeNull();
  });

  it('sends nothing to the score when the player leaves before the line, by any route', () => {
    const t = setup(['p0', 'p1', 'p2']);
    t.go();
    t.play(RULES.countdown + 0.5);
    const scores: (number | null)[] = [];
    const menu = t.game('p0');
    menu.press('start');
    menu.press('select');
    scores.push(menu.step(NONE, 0.05));
    t.game('p1').away();
    scores.push(t.game('p1').step(new Set<Action>(['a']), 0.05));
    t.game('p2').close();
    scores.push(t.game('p2').step(new Set<Action>(['a']), 0.05));
    expect(scores.every((s) => s === null)).toBe(true);
    expect(['p0', 'p1', 'p2'].map((id) => t.game(id).hud().phase)).toEqual(['left', 'left', 'left']);
  });
});
