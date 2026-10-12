import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { tippedOver } from './kart';
import { cuesOf, hudOf, newRace, pause, press, step, type Race, type RaceEvent } from './race';
import { RULES } from './rules';
import { LAPS, parseTrack, TILE, tileAt } from './track';

// The race's phases and what each one lets the player do (PRD 1359, slice 2).

const NONE: ReadonlySet<Action> = new Set();
const GAS: ReadonlySet<Action> = new Set<Action>(['a']);
const track = parseTrack();
const fresh = () => newRace({ seed: 7 });
const started = (r: Race = fresh()) => press(r, 'start').race;
/** Plays `seconds` in 50 ms frames, as the arcade's loop does. */
function play(race: Race, held: ReadonlySet<Action>, seconds: number, dt = 0.05): Race {
  let r = race;
  for (let t = 0; t < seconds - 1e-9; t += dt) r = step(r, held, dt).race;
  return r;
}
const first = <T>(xs: readonly T[]): T => {
  const x = xs[0];
  if (x === undefined) throw new Error('no item');
  return x;
};
const racing = () => play(started(), NONE, RULES.countdown + 0.05);

describe('a new race', () => {
  it('waits on the ready screen with the player on the last starting place, facing the line\'s way, at rest', () => {
    const r = fresh();
    const last = track.places[track.places.length - 1];
    expect(r.phase).toBe('ready');
    expect([r.player.x, r.player.y]).toEqual([last?.x, last?.y]);
    expect(r.player.angle).toBe(track.heading);
    expect(r.player.speed).toBe(0);
    expect(hudOf(r)).toEqual({ phase: 'ready', beat: null });
  });

  it('stands the player on the road', () => {
    const { player } = fresh();
    expect(tileAt(track.map, Math.floor(player.x / TILE), Math.floor(player.y / TILE))).toBe('S');
  });

  it('never starts by itself: the player always chooses when', () => {
    const r = play(fresh(), GAS, 10);
    expect(r.phase).toBe('ready');
    expect(r.player.speed).toBe(0);
  });

  it('refuses a circuit with no starting place', () => {
    expect(() => newRace({ seed: 1, track: { ...track, places: [] } })).toThrow('starting place');
  });
});

describe('the countdown', () => {
  it('runs 3 · 2 · 1 over 3 seconds after START, then the race begins with GO', () => {
    let r = started();
    expect(r.phase).toBe('countdown');
    expect(hudOf(r)).toEqual({ phase: 'countdown', beat: '3' });
    r = play(r, NONE, 1);
    expect(hudOf(r)).toEqual({ phase: 'countdown', beat: '2' });
    r = play(r, NONE, 1);
    expect(hudOf(r)).toEqual({ phase: 'countdown', beat: '1' });
    const before = play(r, NONE, 0.95);
    expect(before.phase).toBe('countdown');
    const go = step(before, NONE, 0.05);
    expect(go.events).toEqual([{ kind: 'go' }]);
    expect(go.race.phase).toBe('race');
    expect(hudOf(go.race)).toMatchObject({ phase: 'race', beat: 'GO' });
  });

  it('shows GO for a moment, then the race alone', () => {
    const r = racing();
    expect(hudOf(r).beat).toBe('GO');
    expect(hudOf(play(r, NONE, RULES.goBanner))).toMatchObject({ phase: 'race', beat: null });
  });

  it('moves nothing when A is held before GO', () => {
    const r = play(started(), GAS, RULES.countdown - 0.1);
    expect(r.phase).toBe('countdown');
    expect(r.player).toEqual(fresh().player);
  });

  it('lets a held A move the kart from GO on', () => {
    const r = play(racing(), GAS, 1);
    expect(r.player.speed).toBeGreaterThan(0);
    expect(r.player.x).not.toBe(fresh().player.x);
  });

  it('is not shortened by START pressed again: it pauses, and resumes where it stopped', () => {
    const mid = play(started(), NONE, 1.5);
    const paused = press(mid, 'start').race;
    expect(paused.phase).toBe('paused');
    expect(play(paused, NONE, 5).clock).toBe(mid.clock);
    const resumed = press(paused, 'start').race;
    expect(resumed.phase).toBe('countdown');
    expect(resumed.clock).toBe(mid.clock);
  });
});

describe('a step', () => {
  it('plays no more than 50 ms of a long frame, in short sub-steps', () => {
    const slow = step(racing(), GAS, 2).race;
    const frame = step(racing(), GAS, RULES.maxDt).race;
    expect(slow.clock).toBeCloseTo(frame.clock, 10);
    expect(slow.player).toEqual(frame.player);
  });

  it('ignores a negative dt', () => {
    const r = racing();
    expect(step(r, GAS, -1).race).toEqual(r);
  });

  it('never leaves a kart tipped over the edge, a slow frame included: it is falling, or back on the road', () => {
    let r = racing();
    for (let i = 0; i < 400; i++) {
      r = step(r, new Set<Action>(['a', i % 90 < 45 ? 'left' : 'right']), i % 7 === 0 ? 1 : 0.05).race;
      expect(!tippedOver(track.map, r.player) || r.fx.fall > 0, `frame ${i}`).toBe(true);
    }
  });

  it('counts the race time from GO', () => {
    expect(play(racing(), NONE, 1).clock - racing().clock).toBeCloseTo(1, 5);
    expect(racing().clock).toBeLessThan(0.1);
  });

  it('steps nothing on the ready screen', () => {
    const r = fresh();
    expect(step(r, GAS, 0.05)).toEqual({ race: r, events: [] });
  });
});

describe('the pause', () => {
  it('pauses on START in the race, holds everything still, and resumes only on START', () => {
    const r = play(racing(), GAS, 1);
    const paused = press(r, 'start').race;
    expect(paused.phase).toBe('paused');
    expect(hudOf(paused)).toMatchObject({ phase: 'paused', beat: null });
    expect(play(paused, GAS, 3)).toEqual(paused);
    for (const a of ['a', 'b', 'left', 'right', 'up', 'down'] as const) expect(press(paused, a), a).toEqual({ race: paused, events: [] });
    const resumed = press(paused, 'start').race;
    expect(resumed.phase).toBe('race');
    expect(resumed.player).toEqual(r.player);
    expect(play(resumed, GAS, 0.5).player.x).not.toBe(r.player.x);
  });

  it('is paused by what happens outside: a blurred window, a hidden tab, leaving the scene', () => {
    const r = racing();
    const paused = pause(r);
    expect(paused.phase).toBe('paused');
    expect(press(paused, 'start').race.phase).toBe('race');
    expect(pause(started()).phase).toBe('paused');
    expect(press(pause(started()), 'start').race.phase).toBe('countdown');
  });

  it('leaves the ready screen and a pause as they are', () => {
    const ready = fresh();
    expect(pause(ready)).toBe(ready);
    const paused = pause(racing());
    expect(pause(paused)).toBe(paused);
  });

  it('goes back to the room on SELECT, from the pause only, and says so', () => {
    const paused = pause(racing());
    expect(press(paused, 'select')).toEqual({ race: paused, events: [{ kind: 'quit' }] });
    for (const r of [fresh(), started(), racing()]) expect(press(r, 'select').events, r.phase).toEqual([]);
  });

  it('does not take the buttons the race reads held for presses', () => {
    const r = racing();
    for (const a of ['a', 'b', 'left', 'right', 'up', 'down'] as const) expect(press(r, a), a).toEqual({ race: r, events: [] });
  });
});

describe('determinism', () => {
  it('gives the same race for the same seed and the same inputs', () => {
    const inputs = (r: Race) => {
      let out = started(r);
      for (let i = 0; i < 600; i++) out = step(out, new Set<Action>(['a', ...(i % 120 < 30 ? (['left'] as const) : i % 120 < 70 ? (['right'] as const) : [])]), i % 5 === 0 ? 0.016 : 0.05).race;
      return out;
    };
    expect(inputs(newRace({ seed: 3 }))).toEqual(inputs(newRace({ seed: 3 })));
    expect(inputs(newRace({ seed: 3 })).player.x).toBeGreaterThan(0);
  });
});

describe('the finish and the race time (slice 4)', () => {
  /** A race one step from the line: the player has done every lap but the last waypoints, just behind the start line. */
  function nearLine(rivals: (r: Race['rivals'][number], i: number) => Race['rivals'][number] = (r) => r): Race {
    const r = racing();
    const [fx, fy] = track.forward;
    const back = 3;
    const player: Race['player'] = { ...r.player, x: track.line.x - fx * back, y: track.line.y - fy * back, angle: track.heading, speed: 100, steer: 0 };
    return { ...r, clock: 100, player, pace: { laps: LAPS - 1, passed: track.waypoints.length }, rivals: r.rivals.map(rivals) };
  }

  it('finishes when the player crosses the line at the end of lap 3, giving the time once', () => {
    let r = nearLine();
    const events = [];
    for (let i = 0; i < 20 && r.phase === 'race'; i++) { const s = step(r, GAS, 0.05); r = s.race; events.push(...s.events); }
    expect(r.phase).toBe('finish');
    const finishes = events.filter((e) => e.kind === 'finish');
    expect(finishes).toHaveLength(1);
    expect(finishes[0]).toEqual({ kind: 'finish', tenths: r.finish?.tenths });
    expect(step(r, GAS, 0.05).events).toEqual([]);
    expect(step(r, GAS, 0.05).race).toBe(r);
  });

  it('does not finish before the last waypoints were passed, nor on the first lap', () => {
    const r = nearLine();
    const skipped = { ...r, pace: { laps: LAPS - 1, passed: 1 } };
    let s = skipped;
    for (let i = 0; i < 20; i++) s = step(s, GAS, 0.05).race;
    expect(s.phase).toBe('race');
  });

  const finished = (): Race => { let r = nearLine(); while (r.phase === 'race') r = step(r, GAS, 0.05).race; return r; };
  const resultsOf = (r: Race) => { if (!r.finish) throw new Error('no results'); return r.finish; };

  it('lists six places with the player among them', () => {
    const { rows, place, tenths } = resultsOf(finished());
    expect(rows.map((x) => x.place)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.filter((x) => x.you)).toHaveLength(1);
    expect(rows.findIndex((x) => x.you) + 1).toBe(place);
    expect(rows.filter((x) => x.you).map((x) => x.tenths)).toEqual([tenths]);
  });

  it('places the rivals still racing by progress, with no time', () => {
    const r = finished();
    const res = resultsOf(r);
    expect(res.rows.filter((x) => !x.you).every((x) => x.tenths === null)).toBe(true);
    expect(hudOf(r)).toEqual({ phase: 'finish', beat: null, results: res });
  });

  it('puts a rival that crossed before the player ahead of the player, with its time', () => {
    let r = nearLine((rv, i) => (i === 0 ? { ...rv, pace: { laps: LAPS, passed: 0 }, doneAt: 90 } : rv));
    while (r.phase === 'race') r = step(r, GAS, 0.05).race;
    const rows = r.finish?.rows ?? [];
    expect(rows[0]?.you).toBe(false);
    expect(rows[0]?.tenths).toBe(900);
    expect(rows[1]?.you).toBe(true);
    expect(r.finish?.place).toBe(2);
  });

  it('answers A on the results with another race, ignores START, and offers no pause', () => {
    let r = nearLine();
    while (r.phase === 'race') r = step(r, GAS, 0.05).race;
    expect(press(r, 'a').events).toEqual([{ kind: 'again' }]);
    expect(press(r, 'start').race.phase).toBe('finish');
    expect(press(r, 'select').events).toEqual([]);
    expect(pause(r).phase).toBe('finish');
  });

  it('gives no finish to a player who quits from the pause before the line', () => {
    const p = press(pause(racing()), 'select');
    expect(p.events).toEqual([{ kind: 'quit' }]);
    expect(p.race.finish).toBeNull();
  });
});

// What a step tells (PRD 1427, slice 2): the countdown's beats, items, boxes, hits, walls, the final lap.
describe('the events of a step', () => {
  const kinds = (events: readonly { kind: string }[]) => events.map((e) => e.kind);

  it('tells beat 3 on START, then beat 2, beat 1 and GO, each once', () => {
    let r = fresh();
    const told: unknown[] = [];
    const pressed = press(r, 'start');
    r = pressed.race;
    told.push(...pressed.events);
    for (let t = 0; t < RULES.countdown + 0.5; t += 0.05) {
      const s = step(r, NONE, 0.05);
      r = s.race;
      told.push(...s.events);
    }
    expect(told).toEqual([{ kind: 'beat', beat: '3' }, { kind: 'beat', beat: '2' }, { kind: 'beat', beat: '1' }, { kind: 'go' }]);
  });

  it('does not tell beat 3 again when a pause resumes the countdown', () => {
    expect(press(pause(started()), 'start').events).toEqual([]);
  });

  it('tells the item the player uses with B, once, and nothing when it holds none', () => {
    const r = racing();
    expect(press(r, 'b').events).toEqual([]);
    const held: Race = { ...r, fx: { ...r.fx, item: 'orb' } };
    expect(press(held, 'b').events).toEqual([{ kind: 'item', racer: 0, item: 'orb' }]);
  });

  it('tells the final lap once, on the step the last lap begins', () => {
    const r = racing();
    const [fx, fy] = track.forward;
    const player: Race['player'] = { ...r.player, x: track.line.x - fx * 3, y: track.line.y - fy * 3, angle: track.heading, speed: 100, steer: 0 };
    let next: Race = { ...r, clock: 100, player, pace: { laps: LAPS - 2, passed: track.waypoints.length } };
    const told: string[] = [];
    for (let i = 0; i < 20; i++) {
      const s = step(next, NONE, 0.05);
      next = s.race;
      told.push(...kinds(s.events));
    }
    expect(told.filter((k) => k === 'finalLap')).toHaveLength(1);
    expect(next.finalAt).not.toBeNull();
  });
});

describe('the cues an event makes', () => {
  it('makes a beep of a beat, a go of GO and a final lap of the final lap', () => {
    expect(cuesOf({ kind: 'beat', beat: '2' }, 0)).toEqual([{ kind: 'beep', beat: '2' }]);
    expect(cuesOf({ kind: 'go' }, 0)).toEqual([{ kind: 'go' }]);
    expect(cuesOf({ kind: 'finalLap' }, 0)).toEqual([{ kind: 'finalLap' }]);
  });

  it('makes an item cue for any racer, with whether it is the player and how far it stands, in tiles', () => {
    expect(cuesOf({ kind: 'item', racer: 0, item: 'boost' }, 0)).toEqual([{ kind: 'item', item: 'boost', you: true, tiles: 0 }]);
    expect(cuesOf({ kind: 'item', racer: 3, item: 'orb' }, 7.5)).toEqual([{ kind: 'item', item: 'orb', you: false, tiles: 7.5 }]);
  });

  it('makes a box cue for the player only', () => {
    expect(cuesOf({ kind: 'box', racer: 0 }, 0)).toEqual([{ kind: 'box' }]);
    expect(cuesOf({ kind: 'box', racer: 2 }, 4)).toEqual([]);
  });

  it('makes a hit cue for any racer, and a spin for the player that spun out', () => {
    expect(cuesOf({ kind: 'hit', racer: 0, item: 'blob', spun: true }, 0)).toEqual([{ kind: 'hit', item: 'blob', you: true, tiles: 0 }, { kind: 'spin' }]);
    expect(cuesOf({ kind: 'hit', racer: 0, item: 'orb', spun: false }, 0)).toEqual([{ kind: 'hit', item: 'orb', you: true, tiles: 0 }]);
    expect(cuesOf({ kind: 'hit', racer: 4, item: 'orb', spun: true }, 12)).toEqual([{ kind: 'hit', item: 'orb', you: false, tiles: 12 }]);
  });

  it('makes nothing of the finish or the player leaving', () => {
    expect(cuesOf({ kind: 'finish', tenths: 1000 }, 0)).toEqual([]);
    expect(cuesOf({ kind: 'quit' }, 0)).toEqual([]);
    expect(cuesOf({ kind: 'again' }, 0)).toEqual([]);
  });
});

// The fall into the void (PRD 1447, slice 2), on COMET RING.

describe('the whole race over the void', () => {
  it('lets every rival finish its three laps with at most one fall, the player standing still', () => {
    for (const seed of [7, 1, 42]) {
      const falls = [0, 0, 0, 0, 0, 0];
      let r = press(newRace({ seed }), 'start').race;
      for (let t = 0; t < RULES.countdown + 0.05; t += 0.05) r = step(r, NONE, 0.05).race;
      const dt = 1 / 60;
      for (let t = 0; t < 600 && r.rivals.some((x) => x.doneAt == null); t += dt) {
        const s = step(r, NONE, dt);
        r = s.race;
        for (const e of s.events) if (e.kind === 'fell') falls[e.racer] = (falls[e.racer] ?? 0) + 1;
      }
      expect(r.rivals.every((x) => x.doneAt != null)).toBe(true);
      expect(falls.slice(1).every((n) => n <= 1)).toBe(true);
    }
  });

  it('gives the same race for the same seed and keys', () => {
    const run = () => { let r = racing(); for (let i = 0; i < 400; i++) r = step(r, GAS, 1 / 60).race; return r; };
    expect(run()).toEqual(run());
  });
});

describe('a fall into the void', () => {
  const FRAME = 1 / 60;
  /** The racing player driving north off the circuit's top edge: the road's top row is row 6, the void above it. */
  const edge = (): Race => {
    const r = racing();
    return { ...r, items: { ...r.items, boxes: [] }, player: { ...r.player, x: 20 * TILE + 8, y: 6 * TILE + 8, angle: -Math.PI / 2, speed: 80, steer: 0 }, fx: { ...r.fx, item: 'blob', boost: 1 } };
  };
  const overVoid = (r: Race) => tileAt(r.track.map, Math.floor(r.player.x / TILE), Math.floor(r.player.y / TILE)) === '~';
  const falling = (r: Race, held: ReadonlySet<Action> = NONE): Race => { let x = r; while (x.fx.fall <= 0) x = step(x, held, FRAME).race; return x; };
  const landed = (r: Race, held: ReadonlySet<Action> = NONE): Race => { let x = r; while (x.fx.fall > 0) x = step(x, held, FRAME).race; return x; };

  it('starts once the kart has tipped over the edge, tells fell once and plays the fall cue; the clock runs through it', () => {
    let r = edge();
    const events: RaceEvent[] = [];
    const clock = r.clock;
    for (let i = 0; i < 90; i++) {
      const s = step(r, GAS, FRAME);
      r = s.race;
      events.push(...s.events.filter((e) => e.kind === 'fell'));
    }
    expect(events).toEqual([{ kind: 'fell', racer: 0 }]);
    expect(cuesOf({ kind: 'fell', racer: 0 }, 0)).toEqual([{ kind: 'fall' }]);
    expect(cuesOf({ kind: 'fell', racer: 3 }, 4)).toEqual([]);
    expect(r.clock).toBeCloseTo(clock + 1.5, 5);
    expect(r.fx.item).toBe('blob');
    expect(r.fx.boost).toBe(0);
  });

  it('does not fall while any of it is still over the road, its centre over the void included', () => {
    for (const y of [6 * TILE + 1, 6 * TILE - 1, 6 * TILE - RULES.overhang + 0.5]) {
      const r = edge();
      expect(step({ ...r, player: { ...r.player, y, speed: 0 } }, NONE, FRAME).race.fx.fall, `y ${y}`).toBe(0);
    }
  });

  it('holds the kart still for a second, then stands it at rest on the road, blinking, its laps kept', () => {
    const e = edge(); // the top edge of the straight between the sixth and seventh waypoints
    const start = { ...e, player: { ...e.player, x: 45 * TILE }, pace: { laps: 1, passed: 6 } };
    let r = falling(start, GAS);
    const where = { x: r.player.x, y: r.player.y };
    expect(overVoid(r)).toBe(true);
    for (let i = 0; i < 50; i++) { r = step(r, GAS, FRAME).race; expect(r.player).toMatchObject(where); }
    r = landed(r);
    expect(overVoid(r)).toBe(false);
    expect(r.player.speed).toBe(0);
    expect(r.fx.blink).toBeGreaterThan(0);
    expect(r.pace).toEqual({ laps: 1, passed: 6 });
  });

  it('drives while it blinks', () => {
    let r = landed(falling(edge()));
    expect(r.fx.blink).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) r = step(r, GAS, FRAME).race;
    expect(r.player.speed).toBeGreaterThan(0);
  });

  it('is out of the contacts while it falls: not pushed, not hit, no box, no item', () => {
    const r = falling(edge());
    const rival = { ...first(r.rivals), kart: { ...r.player, speed: 0 } };
    const items = { ...r.items, blobs: [{ x: r.player.x, y: r.player.y }], boxes: [{ x: r.player.x, y: r.player.y, back: 0 }] };
    const s = step({ ...r, rivals: [rival, ...r.rivals.slice(1)], items, fx: { ...r.fx, item: null } }, NONE, FRAME);
    expect(s.race.player.x).toBe(r.player.x);
    expect(s.race.player.y).toBe(r.player.y);
    expect(s.race.fx.spin).toBe(0);
    expect(s.race.fx.item).toBeNull();
    expect(s.race.items.blobs).toHaveLength(1);
    const used = press({ ...r, fx: { ...r.fx, item: 'boost' } }, 'b');
    expect(used.events).toEqual([]);
    expect(used.race.fx.item).toBe('boost');
  });

  it('can be hit as soon as it is back, though it blinks', () => {
    const r = landed(falling(edge()));
    const s = step({ ...r, items: { ...r.items, blobs: [{ x: r.player.x, y: r.player.y }] } }, NONE, FRAME);
    expect(r.fx.blink).toBeGreaterThan(0);
    expect(s.race.fx.spin).toBeGreaterThan(0);
  });

  it('falls when another kart pushes it over the edge', () => {
    const r = racing();
    // The player hangs over the edge, its centre 5.5 past it; the rival overlapping it from the road pushes it 2 further.
    const rival = { ...first(r.rivals), kart: { ...first(r.rivals).kart, x: 20 * TILE + 8, y: 6 * TILE + 0.5, speed: 0 } };
    const player = { ...r.player, x: 20 * TILE + 8, y: 6 * TILE - 5.5, speed: 0 };
    expect(step({ ...r, player }, NONE, 1 / 120).race.fx.fall).toBe(0);
    const s = step({ ...r, player, rivals: [rival, ...r.rivals.slice(1)] }, NONE, 1 / 120);
    expect(s.race.fx.fall).toBeGreaterThan(0);
    expect(s.events).toContainEqual({ kind: 'fell', racer: 0 });
  });
});
