import { afterEach, describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import type { KartGame } from '../scenes/kart.ts';
import { sure } from '../test/sure';
import { createKart } from './art';
import { createHub } from './hub.fake';
import { GRID_LINES, openGrid, type GridSession, type RaceStart } from './hub';
import { rateFor, readMessage, type GridPlayer } from './net';
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

describe('starting from the grid', () => {
  it('puts two to four players into the same countdown, in the starting order the best times give', () => {
    for (const n of [2, 3, 4]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const t = setup(ids, { p0: 900, p1: 600, ...(n > 2 ? { p2: 700 } : {}) });
      const start = sure(t.go(), 'a start');
      expect(start.order.map((p) => p.id), `${n} players`).toEqual({ 2: ['p1', 'p0'], 3: ['p1', 'p2', 'p0'], 4: ['p1', 'p2', 'p0', 'p3'] }[n]);
      expect([...t.entered.keys()].sort(), `${n} players`).toEqual(ids);
      for (const id of ids) {
        expect(t.game(id).hud(), id).toEqual({ phase: 'countdown', beat: '3' });
        expect(t.entered.get(id)?.race).toBe(start.race);
        expect(t.entered.get(id)?.seed).toBe(start.seed);
      }
    }
  });

  it('starts only for the player who starts, with a second player on the grid', () => {
    const t = setup(['p0', 'p1']);
    expect(t.sessions.get('p1')?.start()).toBeNull();
    expect(setup(['solo']).sessions.get('solo')?.start()).toBeNull();
    expect(t.entered.size).toBe(0);
    expect(t.go()).not.toBeNull();
  });

  it('leaves a fifth player waiting on the grid: only the four who hold a place race', () => {
    const t = setup(['p0', 'p1', 'p2', 'p3', 'p4']);
    const start = sure(t.go(), 'a start');
    expect(start.order).toHaveLength(RULES.places);
    expect([...t.entered.keys()].sort()).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(t.games.has('p4')).toBe(false);
  });

  it('races each player from their own GO: the clock starts when their countdown ends', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown - 0.5);
    expect(t.game('p0').hud().phase).toBe('countdown');
    t.play(0.6);
    expect(t.game('p0').hud().phase).toBe('race');
    expect(t.game('p1').hud().phase).toBe('race');
    t.play(1);
    expect(sure(t.game('p0').hud().run, 'the race line').tenths).toBeLessThan(15);
  });

  it('puts the pole player first and the others behind them in the race line', () => {
    const t = setup(['p0', 'p1', 'p2'], { p0: 900, p1: 600, p2: 700 });
    t.go();
    t.play(RULES.countdown + 0.5);
    expect(['p1', 'p2', 'p0'].map((id) => t.game(id).hud().run?.place)).toEqual([1, 2, 3]);
  });
});

describe('the race over the link', () => {
  /** What an observer on the channel hears from `from`: its state messages. */
  function listen(t: ReturnType<typeof table>, from: string) {
    const states: unknown[] = [];
    t.hub.link('observer').join({}, { presence: () => undefined, message: (id, body) => { if (id === from) states.push(body); }, status: () => undefined });
    return states;
  }

  it('sends each kart\'s state at the send rate: 10, 8 and 5 a second at two, three and four players', () => {
    for (const n of [2, 3, 4]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const t = setup(ids);
      t.go();
      t.play(RULES.countdown + 0.1);
      const heard = listen(t, 'p0');
      t.play(4);
      const states = heard.filter((b) => readMessage(b)?.kind === 'state');
      expect(states.length / 4, `${n} players`).toBeGreaterThan(rateFor(n) - 1);
      expect(states.length / 4, `${n} players`).toBeLessThanOrEqual(rateFor(n));
      expect(n * n * (states.length / 4), `${n} players`).toBeLessThanOrEqual(RULES.messageBudget);
    }
  });

  it('sends nothing before GO and nothing once the player left', () => {
    const t = setup(['p0', 'p1']);
    const heard = listen(t, 'p0');
    t.go();
    t.play(RULES.countdown - 0.3);
    expect(heard.filter((b) => readMessage(b)?.kind === 'state')).toEqual([]);
    t.play(1);
    expect(heard.length).toBeGreaterThan(0);
    t.game('p0').away();
    const sent = heard.length;
    t.play(1);
    expect(heard).toHaveLength(sent);
    expect(readMessage(heard.at(-1))?.kind).toBe('leave');
  });

  it('draws the others from what they send: a kart that drives is seen driving', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.1);
    const drive = new Set<Action>(['a']);
    for (let i = 0; i < 80; i += 1) { t.game('p1').step(drive, 0.05); t.game('p0').step(NONE, 0.05); t.hub.advance(50); }
    // p1 pulled ahead of p0 on the grid, which stood side by side and gave p0 the pole.
    expect(t.game('p0').hud().run?.place).toBe(2);
    expect(t.game('p1').hud().run?.place).toBe(1);
  });

  it('puts a player who leaves OUT at once, on every other screen', () => {
    const t = setup(['p0', 'p1', 'p2']);
    t.go();
    t.play(RULES.countdown + 0.5);
    expect(t.game('p2').hud().run?.place).toBe(3);
    t.game('p0').away();
    t.play(0.2);
    expect(t.game('p2').hud().run?.place).toBe(2);
    t.game('p1').close();
    t.play(0.2);
    expect(t.game('p2').hud().run?.place).toBe(1);
  });

  it('puts a player OUT after 10 seconds when their messages are cut, and not before', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.5);
    expect(t.game('p1').hud().run?.place).toBe(2);
    t.hub.dropIf = (from) => from === 'p0';
    t.play(RULES.outAfter - 1);
    expect(t.game('p1').hud().run?.place).toBe(2);
    t.play(2);
    expect(t.game('p1').hud().run?.place).toBe(1);
  });

  it('ignores a message that does not read, or one from another race', () => {
    const t = setup(['p0', 'p1']);
    const start = sure(t.go(), 'a start');
    t.play(RULES.countdown + 0.5);
    const stranger = t.hub.link('p1'); // sends as p1, as a stale message of an earlier race would
    const far = { kind: 'state', race: 'another', x: 0, y: 0, angle: 0, speed: 0, steer: 0, laps: 2, passed: 0, spin: 0, fall: 0 };
    stranger.send(far);
    stranger.send({ ...far, race: start.race, laps: 'two' });
    stranger.send('state');
    t.play(0.2);
    expect(t.game('p0').hud().run?.place).toBe(1);
    stranger.send({ ...far, race: start.race, laps: 2 });
    expect(t.game('p0').hud().run?.place).toBe(2);
  });

  it('hands the time to the score at the finish, once, and tells the others', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.5);
    const g = t.game('p0');
    const scores: (number | null)[] = [];
    for (let i = 0; i < 4000 && g.hud().phase !== 'finish'; i += 1) scores.push(g.step(new Set<Action>(['a']), 0.05));
    expect(g.hud().phase).toBe('finish');
    const sent = scores.filter((s) => s !== null);
    expect(sent).toHaveLength(1);
    expect(g.hud().results?.tenths).toBe(sent[0]);
    expect(g.step(NONE, 0.05)).toBeNull();
  });
});

describe('leaving the race for the grid', () => {
  it('LEAVE RACE sends the leave and goes back to the grid, which still holds the player', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.5);
    t.game('p0').press('start');
    expect(t.game('p0').hud().menu).toBe(true);
    expect(t.game('p0').press('select')).toEqual({ quit: false, again: false, grid: true });
    expect(t.game('p0').hud().phase).toBe('left');
    expect(sure(t.sessions.get('p0'), 'session').view().rows.map((r) => r.id)).toContain('p0');
  });

  it('a hidden tab reads YOU LEFT THE RACE with A for the grid', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.5);
    t.game('p1').away();
    expect(t.game('p1').hud()).toEqual({ phase: 'left', beat: null });
    expect(t.game('p1').press('a')).toEqual({ quit: false, again: false, grid: true });
  });

  it('stops listening once closed', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.5);
    t.game('p1').close();
    t.game('p0').away();
    t.play(0.2);
    expect(t.game('p1').hud().phase).toBe('left');
  });
});

describe('a player who arrives during a race', () => {
  it('reads RACE ON · <n> RACERS, cannot start, and reads the grid again once nobody races', () => {
    const t = setup(['p0', 'p1']);
    t.go();
    t.play(RULES.countdown + 0.5);
    const late = openGrid(t.hub.link('late'), who('late', 9), () => undefined);
    t.play(0.5);
    expect(late.view().line).toBe(GRID_LINES.raceOn(2));
    expect(late.view().line).toBe('RACE ON · 2 RACERS');
    expect(late.start()).toBeNull();
    t.game('p0').away();
    t.game('p1').away();
    expect(late.view().line).toBe('WAITING FOR P0');
    late.leave();
  });
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
