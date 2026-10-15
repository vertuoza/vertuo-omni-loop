import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import type { GridPlayer, ItemMessage, StateMessage } from './net';
import { away, dropOut, finishOf, hear, hudOf, lift, newRace, plant, pause, press, step, type Race } from './race';
import { RULES } from './rules';
import { crossings } from './line';
import { parseTrack, TILE } from './track';
import { EIGHT } from './track.fake';

// A MULTI race, played by the pure engine (PRD 1572, slice 4): the players on the first places in the
// starting order, no CPU kart, remote karts read from their states and never driven, only the player's
// own kart taking a box, the menu in place of the pause, a hidden tab leaving, a silent player OUT.

const track = parseTrack();
const hero = { v: 1, body: 'girl', skin: 0, hair: 0, suit: 0, cape: 0 } as const;
const who = (id: string): GridPlayer => ({ id, name: id, hero, fleet: null, best: null, arrival: 1 });
const NONE: ReadonlySet<Action> = new Set();
const GAS: ReadonlySet<Action> = new Set<Action>(['a']);

const multi = (me = 'a', ids: readonly string[] = ['a', 'b', 'c']): Race => newRace({ seed: 5, track, field: { me, order: ids.map(who) } });
const play = (race: Race, held: ReadonlySet<Action>, seconds: number, dt = 0.05): Race => {
  let r = race;
  for (let t = 0; t < seconds - 1e-9; t += dt) r = step(r, held, dt).race;
  return r;
};
const racing = (race: Race = multi()): Race => play(press(race, 'start').race, NONE, RULES.countdown + 0.05);
const state = (over: Partial<StateMessage> = {}): StateMessage => ({ kind: 'state', race: 'r', x: 100, y: 100, angle: 0, speed: 0, steer: 0, laps: 0, passed: 0, spin: 0, fall: 0, ...over });
const place = (i: number) => {
  const p = track.places[i];
  if (!p) throw new Error('no place');
  return p;
};
const rival = (race: Race, id: string) => {
  const r = race.rivals.find((x) => x.id === id);
  if (!r) throw new Error(`no rival ${id}`);
  return r;
};

describe('a new MULTI race', () => {
  it('stands the players, and only them, on the first places in the starting order, pole first', () => {
    const r = multi('b', ['c', 'b', 'a']);
    expect(r.mode).toBe('multi');
    expect([r.player.x, r.player.y]).toEqual([place(1).x, place(1).y]);
    expect(r.rivals.map((x) => x.id)).toEqual(['c', 'a']);
    expect([rival(r, 'c').kart.x, rival(r, 'c').kart.y]).toEqual([place(0).x, place(0).y]);
    expect([rival(r, 'a').kart.x, rival(r, 'a').kart.y]).toEqual([place(2).x, place(2).y]);
    expect(r.player.angle).toBe(track.heading);
  });

  it('has no CPU kart: the rivals are the other players, named as they are on the grid', () => {
    const r = multi('a', ['a', 'b']);
    expect(r.rivals).toHaveLength(1);
    expect(rival(r, 'b').driver.name).toBe('B');
  });

  it('refuses a race the player is not in', () => {
    expect(() => multi('z')).toThrow('not in');
  });

  it('enters the countdown at START and begins GO on the clock of the player\'s own', () => {
    let r = press(multi(), 'start').race;
    expect(hudOf(r)).toEqual({ phase: 'countdown', beat: '3' });
    expect(press(r, 'start').race.phase).toBe('countdown');
    r = play(r, NONE, RULES.countdown + 0.05);
    expect(r.phase).toBe('race');
    expect(r.clock).toBeLessThan(0.1);
  });
});

describe('the other players\' karts', () => {
  it('stand where their state puts them, read before and after GO alike', () => {
    let r = press(multi(), 'start').race;
    r = hear(r, 'b', state({ x: 200, y: 210, angle: 1 }));
    expect([rival(r, 'b').kart.x, rival(r, 'b').kart.y, rival(r, 'b').kart.angle]).toEqual([200, 210, 1]);
    expect(hear(multi(), 'b', state()).rivals.find((x) => x.id === 'b')?.kart.x).toBe(place(0).x);
  });

  it('are carried forward along their speed, for half a second at most', () => {
    let r = racing();
    r = hear(r, 'b', state({ x: 100, y: 100, angle: 0, speed: 40 }));
    r = play(r, NONE, 0.25);
    expect(rival(r, 'b').kart.x).toBeCloseTo(110, 0);
    r = play(r, NONE, 2);
    expect(rival(r, 'b').kart.x).toBeCloseTo(100 + 40 * RULES.carry, 5);
    expect(r.rivals.map((x) => x.id)).toContain('b');
  });

  it('are in the way and never moved by a push: the player gets out of them', () => {
    let r = racing();
    r = hear(r, 'b', state({ x: r.player.x + 3, y: r.player.y, angle: 0, speed: 0 }));
    const at = { x: rival(r, 'b').kart.x, y: rival(r, 'b').kart.y };
    r = step(r, NONE, 0.05).race;
    expect([rival(r, 'b').kart.x, rival(r, 'b').kart.y]).toEqual([at.x, at.y]);
    expect(Math.hypot(r.player.x - at.x, r.player.y - at.y)).toBeGreaterThanOrEqual(RULES.radius * 2 - 1e-6);
  });

  it('show a spin-out and a fall as their owner says them, running down as time passes', () => {
    let r = racing();
    r = hear(r, 'b', state({ spin: 0.6, fall: 0.4 }));
    expect(rival(r, 'b').fx?.spin).toBeCloseTo(0.6);
    r = play(r, NONE, 0.5);
    expect(rival(r, 'b').fx?.spin).toBeCloseTo(0.1, 5);
    expect(rival(r, 'b').fx?.fall).toBe(0);
  });

  it('count in your place among the players and no one else', () => {
    let r = racing(multi('a', ['a', 'b', 'c']));
    expect(hudOf(r).run?.place).toBe(1);
    r = hear(r, 'b', state({ laps: 1 }));
    r = hear(r, 'c', state({ laps: 2 }));
    expect(hudOf(r).run?.place).toBe(3);
    r = dropOut(r, 'c');
    expect(hudOf(r).run?.place).toBe(2);
  });

  it('are ignored when the state is not a player of the race, or the race is not on', () => {
    const r = racing();
    expect(hear(r, 'nobody', state({ x: 7 })).rivals).toEqual(r.rivals);
    expect(hear(newRace({ seed: 1 }), 'b', state())).toEqual(newRace({ seed: 1 }));
    expect(hear(multi(), 'b', state({ x: 7 })).rivals.find((x) => x.id === 'b')?.kart.x).not.toBe(7);
  });
});

describe('the boxes', () => {
  const onBox = (race: Race, at: { x: number; y: number }): Race => ({ ...race, items: { ...race.items, blobs: [], boxes: [{ x: at.x, y: at.y, back: 0 }] } });

  it('are taken by the player\'s own kart', () => {
    const r = racing();
    const next = step(onBox(r, r.player), NONE, 0.05).race;
    expect(next.fx.item).not.toBeNull();
    expect(next.items.boxes[0]?.back).toBeGreaterThan(0);
  });

  it('stay on the circuit under a remote kart: only your own kart takes a box', () => {
    let r = racing();
    const far = { x: r.player.x + 60, y: r.player.y };
    r = hear(onBox(r, far), 'b', state({ x: far.x, y: far.y }));
    const next = step(r, NONE, 0.05).race;
    expect(next.items.boxes[0]?.back).toBe(0);
    expect(rival(next, 'b').fx?.item ?? null).toBeNull();
  });
});

describe('the race\'s menu', () => {
  it('opens with ENTER while the race goes on, and closes with ENTER', () => {
    let r = racing();
    r = press(r, 'start').race;
    expect(r.phase).toBe('race');
    expect(hudOf(r).menu).toBe(true);
    r = press(r, 'start').race;
    expect(hudOf(r).menu).toBe(false);
  });

  it('opens when the window loses focus', () => {
    const r = pause(racing());
    expect(r.phase).toBe('race');
    expect(hudOf(r).menu).toBe(true);
  });

  it('lets the clock run and the kart roll on with nothing pressed while it is open', () => {
    let r = racing();
    r = play(r, GAS, 1);
    const speed = r.player.speed;
    r = press(r, 'start').race;
    const clock = r.clock;
    r = play(r, GAS, 1);
    expect(r.clock).toBeCloseTo(clock + 1, 5);
    expect(r.player.speed).toBeLessThan(speed);
  });

  it('keeps B from using an item while it is open', () => {
    const r = press({ ...racing(), fx: { ...racing().fx, item: 'boost' } }, 'start').race;
    expect(press(r, 'b').race.fx.item).toBe('boost');
  });

  it('only ENTER goes back to the race; TAB leaves for the grid and nothing is sent to the score', () => {
    const open = press(racing(), 'start').race;
    expect(press(open, 'select').events).toEqual([{ kind: 'leave' }]);
    expect(press(open, 'select').race.phase).toBe('left');
    expect(press(open, 'a').race.menu).toBe(true);
    expect(press(racing(), 'select').events).toEqual([]);
  });
});

describe('leaving', () => {
  it('a hidden tab leaves the race at once: YOU LEFT THE RACE, A for the grid, nothing finishes', () => {
    const r = away(racing());
    expect(r.phase).toBe('left');
    expect(hudOf(r)).toEqual({ phase: 'left', beat: null });
    expect(step(r, GAS, 1).events).toEqual([]);
    expect(press(r, 'a').events).toEqual([{ kind: 'again' }]);
    expect(press(r, 'start').race.phase).toBe('left');
  });

  it('a hidden tab during the countdown leaves too, and one on the ready screen leaves nothing', () => {
    expect(away(press(multi(), 'start').race).phase).toBe('left');
    expect(away(multi()).phase).toBe('ready');
  });

  it('a SINGLE race pauses as it always did', () => {
    const single = play(press(newRace({ seed: 1 }), 'start').race, NONE, RULES.countdown + 0.05);
    expect(away(single).phase).toBe('paused');
  });
});

describe('a silent player', () => {
  it('is OUT after 10 seconds without a state, their kart gone from the circuit', () => {
    let r = racing();
    r = hear(r, 'b', state());
    r = play(r, NONE, RULES.outAfter - 0.5);
    expect(r.rivals.map((x) => x.id)).toEqual(['b', 'c']);
    r = play(r, NONE, 1);
    expect(r.rivals.map((x) => x.id)).toEqual([]);
    expect([...r.gone].sort()).toEqual(['b', 'c']);
  });

  it('is kept alive by every state that comes', () => {
    let r = racing();
    for (let i = 0; i < 6; i += 1) r = hear(play(r, NONE, 3), 'b', state());
    expect(r.rivals.map((x) => x.id)).toEqual(['b']);
    expect(r.gone).toEqual(['c']);
  });

  it('is OUT at once when they leave', () => {
    const r = dropOut(racing(), 'b');
    expect(r.rivals.map((x) => x.id)).toEqual(['c']);
    expect(r.gone).toEqual(['b']);
    expect(dropOut(r, 'b')).toEqual(r);
  });
});

describe('the finish of a MULTI race (PRD 1572, slice 5)', () => {
  /** The player drives to the line while the players named in `heard` keep sending their state. */
  const cross = (race: Race, heard: readonly string[] = []): Race => {
    let r = race;
    for (let i = 0; i < 6000 && r.phase !== 'finish'; i += 1) r = heard.reduce((x, id) => hear(x, id, state()), step(r, GAS, 0.05).race);
    return r;
  };

  it('a player who crossed the line leaves the circuit and stands ahead of the player still racing', () => {
    const r = finishOf(racing(), 'b', 1100);
    expect(r.rivals.map((x) => x.id)).toEqual(['c']);
    expect(r.finished).toEqual({ b: 1100 });
    expect(hudOf(r).run?.place).toBe(2);
  });

  it('ignores a finish told twice, from a stranger, or before the race', () => {
    const r = finishOf(racing(), 'b', 1100);
    expect(finishOf(r, 'b', 900)).toBe(r);
    expect(finishOf(r, 'z', 900)).toBe(r);
    expect(finishOf(multi(), 'b', 900).finished).toEqual({});
    expect(finishOf(away(racing()), 'b', 900).finished).toEqual({});
  });

  it('lists the results by finish time, then who still races, then who is OUT, and fills in', () => {
    let r = cross(racing(), ['b']);
    const rows = () => (hudOf(r).results?.rows ?? []).map((x) => [x.name, x.tenths === null ? null : 'time', x.out === true]);
    expect(rows()).toEqual([['YOU', 'time', false], ['B', null, false], ['C', null, true]]);
    r = finishOf(r, 'b', 1);
    expect(rows()).toEqual([['B', 'time', false], ['YOU', 'time', false], ['C', null, true]]);
    expect(hudOf(r).results?.place).toBe(2);
    expect(hudOf(r).results?.live).toBe(true);
  });

  it('puts the player behind another who crossed at the same tenth', () => {
    let r = cross(racing(), ['b', 'c']);
    r = finishOf(r, 'b', r.finish?.tenths ?? 0);
    expect(hudOf(r).results?.rows.map((x) => x.name)).toEqual(['B', 'YOU', 'C']);
  });

  it('on the results, hears the others on, and takes a player silent for too long as OUT, never one who finished', () => {
    let r = finishOf(cross(racing(), ['b', 'c']), 'b', 5000);
    r = play(r, NONE, RULES.outAfter - 1);
    expect(r.rivals.map((x) => x.id)).toEqual(['c']);
    r = play(r, NONE, 2);
    expect(r.rivals).toEqual([]);
    expect(r.gone).toEqual(['c']);
    expect(r.finished).toEqual({ b: 5000 });
  });
});

describe('items between players (PRD 1572, slice 6)', () => {
  const sent = (over: Partial<ItemMessage> = {}): ItemMessage => ({ kind: 'item', race: 'r', id: 'b:1', item: 'blob', x: 0, y: 0, angle: 0, ...over });
  const holding = (item: 'blob' | 'orb' | 'boost'): Race => { const r = racing(); return { ...r, fx: { ...r.fx, item } }; };

  it('sends a BLOB dropped and an ORB fired with an id of their own: the sender\'s id and a count', () => {
    const dropped = press(holding('blob'), 'b');
    expect(dropped.events).toContainEqual(expect.objectContaining({ kind: 'throw', id: 'a:1', item: 'blob' }));
    expect(dropped.race.items.blobs.at(-1)?.id).toBe('a:1');
    const r = { ...dropped.race, fx: { ...dropped.race.fx, item: 'orb' as const } };
    const fired = press(r, 'b');
    expect(fired.events).toContainEqual(expect.objectContaining({ kind: 'throw', id: 'a:2', item: 'orb', angle: r.player.angle }));
    expect(fired.race.items.orbs.at(-1)?.id).toBe('a:2');
  });

  it('keeps a BOOST its own: nothing is sent', () => {
    const used = press(holding('boost'), 'b');
    expect(used.events.some((e) => e.kind === 'throw')).toBe(false);
    expect(used.race.fx.boost).toBeGreaterThan(0);
  });

  it('shows a BLOB or an ORB another player sent on this circuit, under its id, once', () => {
    let r = plant(racing(), 'b', sent({ x: 300, y: 300 }));
    expect(r.items.blobs.map((x) => x.id)).toEqual(['b:1']);
    r = plant(r, 'b', sent({ x: 300, y: 300 }));
    expect(r.items.blobs).toHaveLength(1);
    r = plant(r, 'b', sent({ id: 'b:2', item: 'orb', x: 200, y: 200, angle: 1 }));
    expect(r.items.orbs.map((x) => [x.id, x.angle])).toEqual([['b:2', 1]]);
    expect(plant(r, 'a', sent({ id: 'a:9' }))).toBe(r);
    const early = multi();
    expect(plant(early, 'b', sent())).toBe(early);
  });

  it('lets the player hit decide: a remote BLOB on the player\'s kart spins it and gives the hit, which takes it off the circuit', () => {
    const r0 = racing();
    const r = plant(r0, 'b', sent({ x: r0.player.x, y: r0.player.y }));
    const { race, events } = step(r, NONE, 0.05);
    expect(events).toContainEqual({ kind: 'hit', racer: 0, item: 'blob', spun: true, id: 'b:1' });
    expect(race.fx.spin).toBeGreaterThan(0);
  });

  it('leaves an item on a remote kart\'s way until that player\'s hit or its own end', () => {
    let r = hear(racing(), 'b', state({ x: 500, y: 500 }));
    r = plant(r, 'c', sent({ id: 'c:1', x: 500, y: 500 }));
    r = play(r, NONE, 0.5);
    expect(r.items.blobs.map((x) => x.id)).toEqual(['c:1']);
    expect(lift(r, 'c:1').items.blobs).toEqual([]);
    expect(lift(r, 'nope')).toBe(r);
  });

  it('flies a remote ORB along its way, and ends it with its life', () => {
    let r = plant(racing(), 'b', sent({ item: 'orb', x: 40 * TILE, y: 62.5 * TILE, angle: 0 }));
    const x0 = r.items.orbs[0]?.x ?? 0;
    r = play(r, NONE, 0.2);
    expect(r.items.orbs[0]?.x).toBeGreaterThan(x0);
    r = play(r, NONE, RULES.orbLife);
    expect(r.items.orbs).toEqual([]);
  });
});

describe('a MULTI race with looks and laps (PRD 1762)', () => {
  const look = { color: 'RED', design: 'ROCKET' };
  const dressed = (laps?: number) => newRace({ seed: 5, track, field: { me: 'a', order: [{ ...who('a'), look }, { ...who('b'), look: { color: 'PINK', design: 'RACER' } }, who('c')], ...(laps !== undefined ? { laps } : {}) } });

  it('races 3 laps when the field says none, and the field\'s laps otherwise', () => {
    expect(dressed().laps).toBe(3);
    expect(dressed(5).laps).toBe(5);
    expect(dressed(7).laps).toBe(7);
  });

  it('draws a remote kart with its look, and one with none as today', () => {
    const race = dressed();
    expect(rival(race, 'b').driver.look).toEqual({ color: 'PINK', design: 'RACER' });
    expect(rival(race, 'c').driver.look).toBeUndefined();
  });

  it('gives the player\'s own kart the look its entry carries', () => {
    expect(dressed().look).toEqual(look);
    expect(multi().look).toBeUndefined();
  });

  it('puts the whole race\'s time on the results and the three-lap time apart, in a race of 5 laps', () => {
    let r = press(dressed(5), 'start').race;
    for (let i = 0; i < 12000 && r.phase !== 'finish'; i += 1) r = ['b', 'c'].reduce((x, id) => hear(x, id, state()), step(r, GAS, 0.05).race);
    expect(r.phase).toBe('finish');
    expect(r.finish?.threeLap).toBeLessThan(r.finish?.tenths ?? 0);
  });
});

// The branch at a crossing (PRD 1923, slice 1): a player heard on a figure eight stays on the branch it was heard on.
describe('a MULTI race on a line that crosses itself', () => {
  const eight = parseTrack(EIGHT);
  const c = crossings(eight.centre)[0];
  const second = eight.centre.segments.find((s) => s.kind === 'straight' && s.leg === c?.b.leg);
  const onEight = (): Race => newRace({ seed: 5, track: eight, field: { me: 'a', order: ['a', 'b'].map(who) } });

  it('keeps a remote kart on the branch it was heard on, state after state, across the crossing', () => {
    if (!c || !second) throw new Error('a figure eight crosses itself');
    let r = press(onEight(), 'start').race;
    for (const tiles of [-5, -2.5, 0, 2.5, 5]) {
      const x = (c.x + c.b.tx * tiles) * TILE;
      const y = (c.y + c.b.ty * tiles) * TILE;
      r = hear(r, 'b', state({ x, y, angle: Math.atan2(c.b.ty, c.b.tx), speed: 60, passed: 6 }));
      r = play(r, NONE, RULES.countdown + 0.05);
      const heard = rival(r, 'b').kart.along ?? NaN;
      expect(Math.abs(heard - (second.start + c.b.at + tiles) * TILE)).toBeLessThan(TILE / 2 + 60 * RULES.carry);
    }
  });
});

describe('the rocket start in a MULTI race (PRD 1963)', () => {
  it('is each player\'s own: theirs on their own countdown, and none for the others\' karts', () => {
    const counted = play(play(press(multi(), 'start').race, NONE, 1.2), GAS, RULES.countdown - 1.25);
    const go = step(counted, GAS, 0.05).race;
    expect(go.fx.boost).toBe(RULES.rocketTime);
    expect(go.rivals.every((r) => (r.fx?.boost ?? 0) === 0)).toBe(true);
    const early = step(play(play(press(multi(), 'start').race, NONE, 0.2), GAS, RULES.countdown - 0.25), GAS, 0.05).race;
    expect(early.stall).toBe(RULES.stallTime);
  });
});
