import { describe, expect, it } from 'vitest';
import type { KartGridView } from '../scenes/kart.ts';
import { createHub } from './hub.fake';
import { GRID_LINES, openGrid, type GridSession } from './hub';
import { presenceOf, type GridPlayer } from './net';
import type { KartLinkEvents } from '../types';

// The grid, through the in-memory hub (PRD 1572, slice 3): two to five players see the same grid in
// the same order, the first to arrive starts, the places are four, and a dropped or refused link reads as such.

const hero = { v: 1, body: 'girl', skin: 0, hair: 0, suit: 0, cape: 0 } as const;
const who = (id: string, arrival: number, best: number | null = null): GridPlayer => ({ id, name: id, hero, fleet: null, best, arrival });

function room(delay = 0) {
  const hub = createHub();
  hub.delay = delay;
  const sessions = new Map<string, GridSession>();
  const views = new Map<string, KartGridView[]>();
  const join = (player: GridPlayer) => {
    const seen: KartGridView[] = [];
    views.set(player.id, seen);
    sessions.set(player.id, openGrid(hub.link(player.id), player, (v) => { seen.push(v); }));
  };
  return { hub, sessions, views, join, view: (id: string) => sessions.get(id)?.view() as KartGridView, order: (id: string) => (sessions.get(id)?.view().rows ?? []).map((r) => r.id) };
}

describe('the grid over the hub', () => {
  it('shows a player alone WAITING FOR RACERS', () => {
    const r = room();
    r.join(who('a', 1));
    expect(r.view('a').line).toBe('WAITING FOR RACERS');
    expect(r.view('a').state).toBe('joined');
  });

  it('shows the first to arrive START RACE and the others WAITING FOR <NAME>', () => {
    const r = room();
    r.join(who('ada', 1));
    r.join(who('bo', 2));
    r.join(who('cy', 3));
    expect(r.view('ada').line).toBe('START RACE');
    expect(r.view('bo').line).toBe('WAITING FOR ADA');
    expect(r.view('cy').line).toBe('WAITING FOR ADA');
  });

  it('hands the start to the next by arrival when the starter leaves', () => {
    const r = room();
    r.join(who('ada', 1));
    r.join(who('bo', 2));
    r.join(who('cy', 3));
    r.sessions.get('ada')?.leave();
    expect(r.view('bo').line).toBe('START RACE');
    expect(r.view('cy').line).toBe('WAITING FOR BO');
    expect(r.order('bo')).toEqual(['bo', 'cy']);
  });

  it('shows two to four players the same grid in the same order, by best time', () => {
    for (const n of [2, 3, 4]) {
      const r = room();
      const times = [900, null, 600, 700];
      for (let i = 0; i < n; i += 1) r.join(who(`p${i}`, i + 1, times[i] ?? null));
      const orders = [...r.sessions.keys()].map((id) => r.order(id));
      expect(new Set(orders.map((o) => o.join())).size, `${n} players`).toBe(1);
      expect(orders[0]).toEqual({ 2: ['p0', 'p1'], 3: ['p2', 'p0', 'p1'], 4: ['p2', 'p3', 'p0', 'p1'] }[n]);
    }
  });

  it('shows the fifth GRID FULL · 4 RACERS, listed last, and gives them the first place that frees', () => {
    const r = room();
    for (let i = 1; i <= 5; i += 1) r.join(who(`p${i}`, i));
    expect(r.view('p5').line).toBe('GRID FULL · 4 RACERS');
    expect(GRID_LINES.full).toBe('GRID FULL · 4 RACERS');
    expect(r.view('p1').line).toBe('START RACE');
    expect(r.view('p5').rows.map((x) => x.seat)).toEqual([true, true, true, true, false]);
    expect(r.order('p5').at(-1)).toBe('p5');
    r.sessions.get('p2')?.leave();
    expect(r.view('p5').line).toBe('WAITING FOR P1');
    expect(r.view('p5').rows.every((x) => x.seat)).toBe(true);
  });

  it('settles on the same grid once delayed messages arrive, and shows the player themselves meanwhile', () => {
    const r = room(50);
    r.join(who('a', 1));
    expect(r.view('a').state).toBe('joining');
    expect(r.view('a').line).toBe('JOINING THE GRID…');
    expect(r.order('a')).toEqual(['a']);
    r.join(who('b', 2));
    r.hub.advance(49);
    expect(r.view('a').state).toBe('joining');
    r.hub.advance(1);
    expect(r.view('a').state).toBe('joined');
    r.hub.advance(100);
    expect(r.order('a')).toEqual(['a', 'b']);
    expect(r.order('b')).toEqual(['a', 'b']);
  });

  it('reads an entry that does not read as no player', () => {
    const r = room();
    r.join(who('a', 1));
    r.hub.link('x').join({ id: 'x', name: '' }, { presence: () => {}, message: () => {}, status: () => {} });
    expect(r.order('a')).toEqual(['a']);
  });

  it('reads a refused join GRID OUT OF REACH · A TO RETRY, and tries again on retry', () => {
    const r = room();
    r.hub.refuse('a');
    r.join(who('a', 1));
    expect(r.view('a')).toEqual({ state: 'out', rows: [], line: 'GRID OUT OF REACH · A TO RETRY' });
    r.sessions.get('a')?.retry();
    expect(r.view('a').state).toBe('out');
    expect(r.views.get('a')?.length).toBeGreaterThan(1);
  });

  it('reads a dropped channel RECONNECTING…, keeps the players, and reads the grid again once it is back', () => {
    const hub = createHub();
    const held: { on: KartLinkEvents | null } = { on: null };
    const link = hub.link('a');
    const seen: KartGridView[] = [];
    const spy = { ...link, join: (w: Record<string, unknown>, on: KartLinkEvents) => { held.on = on; link.join(w, on); } };
    const session = openGrid(spy, who('a', 1), (v) => { seen.push(v); });
    hub.link('b').join(who('b', 2), { presence: () => {}, message: () => {}, status: () => {} });
    expect(session.view().rows).toHaveLength(2);
    held.on?.status('reconnecting');
    expect(session.view().line).toBe('RECONNECTING…');
    expect(session.view().rows).toHaveLength(2);
    held.on?.status('joined');
    expect(session.view().state).toBe('joined');
    expect(session.view().line).toBe('START RACE');
  });

  it('retry does nothing while the grid is not out of reach', () => {
    const r = room();
    r.join(who('a', 1));
    const before = r.views.get('a')?.length;
    r.sessions.get('a')?.retry();
    expect(r.views.get('a')?.length).toBe(before);
  });

  it('says nothing more once the player left, and leaves the grid for the others', () => {
    const r = room();
    r.join(who('a', 1));
    r.join(who('b', 2));
    const heard = r.views.get('a')?.length;
    r.sessions.get('a')?.leave();
    expect(r.hub.present()).toEqual(['b']);
    r.join(who('c', 3));
    expect(r.views.get('a')?.length).toBe(heard);
  });

  it('delivers a message to everyone but its sender, and loses a dropped one', () => {
    const hub = createHub();
    const got: string[] = [];
    const on = (name: string) => ({ presence: () => {}, message: (from: string, body: unknown) => { got.push(`${name}<${from}:${String(body)}`); }, status: () => {} });
    const [a, b, c] = ['a', 'b', 'c'].map((id) => hub.link(id));
    a?.join({}, on('a')); b?.join({}, on('b')); c?.join({}, on('c'));
    hub.dropIf = (_from, to) => to === 'c';
    a?.send('hi');
    expect(got).toEqual(['b<a:hi']);
    hub.delay = 10;
    hub.dropIf = () => false;
    b?.send('late');
    expect(got).toHaveLength(1);
    hub.advance(10);
    expect(got.sort()).toEqual(['a<b:late', 'b<a:hi', 'c<b:late']);
  });
});

describe('the grid\'s looks and laps (PRD 1762)', () => {
  const dressed = (id: string, arrival: number, laps?: number, look?: { color: string; design: string }): GridPlayer => ({ ...who(id, arrival), ...(laps !== undefined ? { laps } : {}), ...(look ? { look } : {}) });

  it('titles the grid with the first arrival\'s laps when every entry carries laps, and lists each kart in its look', () => {
    const r = room();
    r.join(dressed('a', 1, 5, { color: 'RED', design: 'ROCKET' }));
    r.join(dressed('b', 2, 7));
    expect(r.view('b').laps).toBe(5);
    expect(r.view('a').rows.find((x) => x.id === 'a')?.look).toEqual({ color: 'RED', design: 'ROCKET' });
    expect(r.view('a').rows.find((x) => x.id === 'b')?.look).toBeUndefined();
  });

  it('says 3 laps when an entry carries none', () => {
    const r = room();
    r.join(dressed('a', 1, 5));
    r.join(who('b', 2));
    expect(r.view('a').laps).toBe(3);
  });

  it('sends the first arrival\'s laps on the start, and 3 from an old entry', () => {
    const r = room();
    r.join(dressed('a', 1, 5));
    r.join(dressed('b', 2, 7));
    expect(r.sessions.get('a')?.start()?.laps).toBe(5);
    const old = room();
    old.join(dressed('a', 1, 5));
    old.join(who('b', 2));
    expect(old.sessions.get('a')?.start()?.laps).toBe(3);
  });

  it('reads a start without laps as 3 laps', () => {
    const hub = createHub();
    const got: number[] = [];
    const me = dressed('b', 2, 5);
    openGrid(hub.link('b'), me, () => undefined, (s) => { got.push(s.laps); });
    const sender = hub.link('a');
    sender.join({}, { presence: () => undefined, message: () => undefined, status: () => undefined });
    sender.send({ kind: 'start', race: 'r', seed: 1, order: [presenceOf(dressed('a', 1)), presenceOf(me)] });
    expect(got).toEqual([3]);
  });
});

describe('the grid\'s circuit (PRD 1923)', () => {
  const on = (id: string, arrival: number, track?: string): GridPlayer => ({ ...who(id, arrival), ...(track !== undefined ? { track } : {}) });

  it('sends the first arrival\'s circuit on the start,', () => {
    const r = room();
    r.join(on('a', 1, 'comet-ring'));
    r.join(on('b', 2));
    expect(r.sessions.get('a')?.start()?.track).toBe('comet-ring');
  });

  it('races COMET RING from an entry without a track, and from a start without one', () => {
    const hub = createHub();
    const got: string[] = [];
    const me = on('b', 2);
    openGrid(hub.link('b'), me, () => undefined, (s) => { got.push(s.track); });
    const sender = hub.link('a');
    sender.join({}, { presence: () => undefined, message: () => undefined, status: () => undefined });
    sender.send({ kind: 'start', race: 'r', seed: 1, order: [presenceOf(on('a', 1)), presenceOf(me)] });
    sender.send({ kind: 'start', race: 'r2', seed: 1, order: [presenceOf(on('a', 1)), presenceOf(me)], track: 'comet-ring' });
    sender.send({ kind: 'start', race: 'r3', seed: 1, order: [presenceOf(on('a', 1)), presenceOf(me)], track: 'moon-base' });
    expect(got).toEqual(['comet-ring', 'comet-ring']);
  });
});
