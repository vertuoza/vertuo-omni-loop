import { afterEach, describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import type { KartGame } from '../scenes/kart.ts';
import { sure } from '../test/sure';
import { createKart } from './art';
import type { Item } from './items';
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
  /** What a player holds when their race starts. */
  const holding = new Map<string, Item>();
  const enter = (id: string, start: RaceStart) => {
    const me = sure(people.get(id), `player ${id}`);
    entered.set(id, start);
    const held = holding.get(id);
    games.set(id, createKart({ seed: start.seed, live: { session: sure(sessions.get(id), `session ${id}`), start, me }, ...(held ? { held } : {}) }));
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
  const play = (seconds: number, only?: readonly string[]) => {
    for (let t = 0; t < seconds - 1e-9; t += 0.05) {
      for (const id of only ?? [...games.keys()]) game(id).step(NONE, 0.05);
      hub.advance(50);
    }
  };
  return { hub, sessions, games, entered, go, game, play, people, holding, enter };
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
    for (let i = 0; i < 12000 && g.hud().phase !== 'finish'; i += 1) scores.push(g.step(new Set<Action>(['a']), 0.05));
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

describe('items between players (slice 6)', () => {
  const ids = ['a', 'b', 'c', 'd'];
  /** Four players: `a` has no time so starts last, on the place right behind `b`, who is on pole. */
  const table4 = () => {
    const t = setup(ids, { b: 500, c: 600, d: 700 });
    t.hub.delay = 100;
    return t;
  };
  const heard = (t: ReturnType<typeof table>) => {
    const bodies: unknown[] = [];
    t.hub.link('observer').join({}, { presence: () => undefined, message: (_id, body) => { bodies.push(body); }, status: () => undefined });
    return bodies;
  };

  it('an ORB fired by A spins B out on both screens, and the item is gone on both', () => {
    const t = table4();
    t.holding.set('a', 'orb');
    t.go('a');
    t.play(RULES.countdown + 0.2);
    const bodies = heard(t);
    t.game('a').cues();
    t.game('b').cues();
    t.game('a').press('b');
    t.play(1.5);
    const messages = bodies.flatMap((b) => { const m = readMessage(b); return m ? [m] : []; });
    expect(messages.filter((m) => m.kind === 'item')).toEqual([expect.objectContaining({ kind: 'item', id: 'a:1', item: 'orb' })]);
    expect(messages.filter((m) => m.kind === 'hit')).toEqual([expect.objectContaining({ kind: 'hit', id: 'a:1' })]);
    // B's screen: the ORB arrived, hit B, and spun B out.
    const mine = t.game('b').cues();
    expect(mine).toContainEqual({ kind: 'hit', item: 'orb', you: true, tiles: 0 });
    expect(mine).toContainEqual({ kind: 'spin' });
    // A's screen: the hit on B was seen, and the item is off its circuit.
    expect(t.game('a').cues().some((c) => c.kind === 'hit' && !c.you)).toBe(true);
    // Taken off every circuit, the ORB hits no one else, however long it would have flown.
    t.play(RULES.orbLife);
    for (const id of ['a', 'c', 'd']) expect(t.game(id).cues().some((c) => c.kind === 'spin'), id).toBe(false);
  });

  it('a BLOB dropped by A reaches every circuit', () => {
    const t = table4();
    t.holding.set('a', 'blob');
    t.go('a');
    t.play(RULES.countdown + 0.2);
    const bodies = heard(t);
    t.game('a').press('b');
    t.play(0.5);
    const dropped = bodies.flatMap((b) => { const m = readMessage(b); return m?.kind === 'item' ? [m] : []; });
    expect(dropped).toEqual([expect.objectContaining({ id: 'a:1', item: 'blob' })]);
    for (const id of ['b', 'c', 'd']) expect(t.game(id).cues().some((c) => c.kind === 'item' && !c.you && c.item === 'blob'), id).toBe(true);
    expect(bodies.some((b) => readMessage(b)?.kind === 'hit')).toBe(false);
  });

  it('a BOOST stays the player\'s own: nothing is sent', () => {
    const t = table4();
    t.holding.set('a', 'boost');
    t.go('a');
    t.play(RULES.countdown + 0.2);
    const bodies = heard(t);
    t.game('a').press('b');
    t.play(0.5);
    expect(bodies.some((b) => { const k = readMessage(b)?.kind; return k === 'item' || k === 'hit'; })).toBe(false);
  });
});

describe('looks and laps over the hub (PRD 1762)', () => {
  it('runs the first arrival\'s 5 laps for a grid of two new tabs, and draws a remote kart with its look', () => {
    const t = setup(['p0', 'p1']);
    t.people.set('p0', { ...who('p0', 1), laps: 5, look: { color: 'RED', design: 'ROCKET' } });
    t.people.set('p1', { ...who('p1', 2), laps: 7, look: { color: 'PINK', design: 'RACER' } });
    for (const id of ['p0', 'p1']) { t.sessions.get(id)?.leave(); t.sessions.set(id, openGrid(t.hub.link(id), sure(t.people.get(id), id), () => undefined, (start) => { t.enter(id, start); })); }
    const start = sure(t.go(), 'a start');
    expect(start.laps).toBe(5);
    expect(t.game('p1').hud()).toEqual({ phase: 'countdown', beat: '3' });
    expect(t.entered.get('p1')?.laps).toBe(5);
    expect(start.order.find((p) => p.id === 'p0')?.look).toEqual({ color: 'RED', design: 'ROCKET' });
  });

  it('runs 3 laps for a grid with one old entry', () => {
    const t = setup(['p0', 'p1']);
    t.people.set('p0', { ...who('p0', 1), laps: 5 });
    t.sessions.get('p0')?.leave();
    t.sessions.set('p0', openGrid(t.hub.link('p0'), sure(t.people.get('p0'), 'p0'), () => undefined, (start) => { t.enter('p0', start); }));
    expect(sure(t.go(), 'a start').laps).toBe(3);
  });
});
