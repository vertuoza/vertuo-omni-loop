import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { NO_FX, tippedOver } from './kart';
import { cuesOf, hudOf, newRace, pause, press, step, type Race, type RaceEvent } from './race';
import { advance, crossedAnyGate, START_PACE } from './rivals';
import { sure } from '../test/sure';
import { RULES } from './rules';
import { COMET_RING, LAPS, parseTrack, roadAt, TILE, tileAt } from './track';

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
      expect(!tippedOver(track, r.player) || r.fx.fall > 0, `frame ${i}`).toBe(true);
    }
  });

  it('never leaves a kart tipped over on its side for longer than the grace without falling', () => {
    let r = racing();
    for (let i = 0; i < 400; i++) {
      r = step(r, new Set<Action>(['a', i % 90 < 45 ? 'left' : 'right']), i % 7 === 0 ? 1 : 0.05).race;
      expect(r.fx.tip <= RULES.tipGrace + 1e-9 || r.fx.fall > 0, `frame ${i}`).toBe(true);
      for (const x of r.rivals) expect((x.fx ?? NO_FX).tip <= RULES.tipGrace + 1e-9 || (x.fx ?? NO_FX).fall > 0).toBe(true);
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
    expect(hudOf(r)).toMatchObject({ phase: 'finish', beat: null, results: res });
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

  it('shows the podium before the results: A on the podium shows the results, the time already sent', () => {
    let r = nearLine();
    let sent = 0;
    while (r.phase === 'race') { const st = step(r, GAS, 0.05); sent += st.events.filter((e) => e.kind === 'finish').length; r = st.race; }
    expect(sent).toBe(1);
    expect(hudOf(r).podium?.steps).toHaveLength(3);
    expect(press(r, 'a').events).toEqual([]);
    const results = press(r, 'a').race;
    expect(hudOf(results).podium).toBeUndefined();
    expect(hudOf(results).results?.threeLap).toBe(r.finish?.threeLap);
  });

  it('shows no podium for a race left before the line', () => {
    const left = pause(nearLine());
    expect(hudOf(left).podium).toBeUndefined();
    expect(press(left, 'a').events).toEqual([]);
  });

  it('answers A on the results with another race, ignores START, and offers no pause', () => {
    let r = nearLine();
    while (r.phase === 'race') r = step(r, GAS, 0.05).race;
    expect(press(press(r, 'a').race, 'a').events).toEqual([{ kind: 'again' }]);
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
  it('lets every rival finish its three laps without a single fall, the player standing still', () => {
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
      expect(falls.slice(1), `seed ${seed}`).toEqual([0, 0, 0, 0, 0]);
    }
  });

  it('gives the same race for the same seed and keys', () => {
    const run = () => { let r = racing(); for (let i = 0; i < 400; i++) r = step(r, GAS, 1 / 60).race; return r; };
    expect(run()).toEqual(run());
  });
});

describe('a fall into the void', () => {
  const FRAME = 1 / 60;
  /** The racing player driving north off the circuit's top edge: the start straight's top row is row 60, the void above it. */
  const edge = (): Race => {
    const r = racing();
    return { ...r, items: { ...r.items, boxes: [] }, player: { ...r.player, x: 40 * TILE + 8, y: 60 * TILE + 8, angle: -Math.PI / 2, speed: 80, steer: 0 }, fx: { ...r.fx, item: 'blob', boost: 1 } };
  };
  const overVoid = (r: Race) => !roadAt(r.track, r.player.x, r.player.y);
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
    for (const y of [60 * TILE + 1, 60 * TILE - 1, 60 * TILE - RULES.wheelAlong + 0.5]) {
      const r = edge();
      expect(step({ ...r, player: { ...r.player, y, speed: 0 } }, NONE, FRAME).race.fx.fall, `y ${y}`).toBe(0);
    }
  });

  it('holds the kart still for a second, then stands it at rest on the road, blinking, its laps kept', () => {
    const e = edge(); // the top edge of the start straight
    const start = { ...e, player: { ...e.player, x: 40 * TILE }, pace: { laps: 1, passed: 0 } };
    let r = falling(start, GAS);
    const where = { x: r.player.x, y: r.player.y };
    expect(overVoid(r)).toBe(true);
    for (let i = 0; i < 50; i++) { r = step(r, GAS, FRAME).race; expect(r.player).toMatchObject(where); }
    r = landed(r);
    expect(overVoid(r)).toBe(false);
    expect(r.player.speed).toBe(0);
    expect(r.fx.blink).toBeGreaterThan(0);
    expect(r.pace).toEqual({ laps: 1, passed: 0 });
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
    // The player faces the edge and hangs over it, its centre 5.5 past it (a rear wheel on the road); the rival overlapping it from the road pushes it 2 further.
    const rival = { ...first(r.rivals), kart: { ...first(r.rivals).kart, x: 40 * TILE + 8, y: 60 * TILE + 0.5, angle: -Math.PI / 2, speed: 0 } };
    const player = { ...r.player, x: 40 * TILE + 8, y: 60 * TILE - 5.5, angle: -Math.PI / 2, speed: 0 };
    expect(step({ ...r, player }, NONE, 1 / 120).race.fx.fall).toBe(0);
    const s = step({ ...r, player, rivals: [rival, ...r.rivals.slice(1)] }, NONE, 1 / 120);
    expect(s.race.fx.fall).toBeGreaterThan(0);
    expect(s.events).toContainEqual({ kind: 'fell', racer: 0 });
  });

  // The gap jump (PRD 1775) is 3 tiles of void across the racing line, so the nearest point of the line is no way back there (bug 1820).
  describe('into the gap jump, where the racing line crosses the void (bug 1820)', () => {
    /** The racing player on the gap jump's ramp, heading north up the ramp at row 22 far too slowly to clear the gap. */
    const short = (): Race => {
      const r = racing();
      return { ...r, items: { ...r.items, boxes: [] }, player: { ...r.player, x: 64.5 * TILE, y: 22.5 * TILE, angle: -Math.PI / 2, speed: 30, steer: 0 }, pace: { laps: 1, passed: 5 } };
    };
    /** The race played with `held` until `done` holds, 4 seconds at most. */
    const until = (r: Race, held: ReadonlySet<Action>, done: (x: Race) => boolean): Race => {
      let x = r;
      for (let t = 0; t < 4 && !done(x); t += FRAME) x = step(x, held, FRAME).race;
      return x;
    };
    const fallen = (): Race => until(short(), GAS, (x) => x.fx.fall > 0);
    const back = (): Race => until(fallen(), NONE, (x) => x.fx.fall <= 0);

    it('comes back on the road, at rest a run-up before the ramp, and does not fall again', () => {
      const down = fallen();
      expect(down.fx.fall).toBeGreaterThan(0);
      expect(overVoid(down)).toBe(true);
      const fellAt = down.player.y;
      let r = back();
      expect(r.fx.fall, 'still falling 3 s after its fall ended').toBe(0);
      expect(overVoid(r)).toBe(false);
      expect(r.player.y, 'behind the ramp').toBeGreaterThan(23 * TILE);
      expect(r.player.y, 'within a run-up of it').toBeLessThan(23 * TILE + RULES.runUp + TILE);
      expect(r.player.y).toBeGreaterThan(fellAt);
      expect(r.player.speed).toBe(0);
      expect(r.pace).toEqual({ laps: 1, passed: 5 });
      for (let i = 0; i < 60; i++) { r = step(r, NONE, FRAME).race; expect(r.fx.fall, `frame ${i}`).toBe(0); }
    });

    it('clears the gap from there with the gas held, and drives on towards the tunnel', () => {
      let r = back();
      let falls = 0;
      for (let i = 0; i < 6 / FRAME && r.player.y > 10 * TILE; i++) {
        const s = step(r, GAS, FRAME);
        r = s.race;
        falls += s.events.filter((e) => e.kind === 'fell' && e.racer === 0).length;
      }
      expect(falls).toBe(0);
      expect(r.player.y).toBeLessThan(10 * TILE);
    });
  });
});

describe('the hills under the player (PRD 1698)', () => {
  // The west straight runs south from waypoint 12 to waypoint 13; a hump of 26 at its middle.
  const n = track.waypoints.length;
  const zero = Array.from({ length: n }, () => 0);
  const level = parseTrack({ ...COMET_RING, relief: { heights: zero, bumps: zero } });
  const hump = parseTrack({ ...COMET_RING, relief: { heights: zero, bumps: zero.map((_, i) => (i === n - 2 ? 26 : 0)) } });
  const a = hump.waypoints[n - 2], b = hump.waypoints[n - 1];
  if (!a || !b) throw new Error('no waypoints');
  const speedAfter = (on: typeof hump, share: number): number => {
    const y = a.y + 2.5 * TILE + share * (b.y - a.y - 5 * TILE);
    const r = play(started(newRace({ seed: 7, track: on })), NONE, RULES.countdown + 0.05);
    return play({ ...r, player: { x: a.x, y, angle: Math.PI / 2, speed: RULES.topSpeed, steer: 0 } }, GAS, 0.5).player.speed;
  };

  it('slows the player climbing and speeds it descending, as the flat circuit does not', () => {
    const flat = speedAfter(level, 0.25);
    expect(flat).toBeCloseTo(RULES.topSpeed, 0);
    expect(speedAfter(hump, 0.25)).toBeLessThan(flat * 0.95);
    expect(speedAfter(hump, 0.6)).toBeGreaterThan(flat * 1.05);
  });
});

describe('the rivals\' difficulty (PRD 1762)', () => {
  const LEVELS = ['easy', 'normal', 'hard'] as const;
  const FRAME = 1 / 60;
  /** Plays a whole race with the player standing still: each rival's finish time and falls. */
  const run = (seed: number, difficulty: (typeof LEVELS)[number]) => {
    const falls = [0, 0, 0, 0, 0, 0];
    let r = press(newRace({ seed, difficulty }), 'start').race;
    for (let t = 0; t < RULES.countdown + 0.05; t += 0.05) r = step(r, NONE, 0.05).race;
    for (let t = 0; t < 900 && r.rivals.some((x) => x.doneAt == null); t += FRAME) {
      const s = step(r, NONE, FRAME);
      r = s.race;
      for (const e of s.events) if (e.kind === 'fell') falls[e.racer] = (falls[e.racer] ?? 0) + 1;
    }
    return { times: r.rivals.map((x) => x.doneAt), falls: falls.slice(1) };
  };
  const results = new Map<string, ReturnType<typeof run>>();
  for (const seed of [1, 7, 42]) for (const level of LEVELS) results.set(`${seed}/${level}`, run(seed, level));
  const mean = (level: (typeof LEVELS)[number]) => {
    const all = [1, 7, 42].flatMap((seed) => results.get(`${seed}/${level}`)?.times ?? []);
    return all.reduce<number>((a, b) => a + (b ?? Infinity), 0) / all.length;
  };

  it('makes NORMAL when no level is given, and keeps the level on the race', () => {
    expect(newRace({ seed: 1 }).difficulty).toBe('normal');
    expect(newRace({ seed: 1, difficulty: 'hard' }).difficulty).toBe('hard');
    expect(newRace({ seed: 1 }).rivals).toEqual(newRace({ seed: 1, difficulty: 'normal' }).rivals);
  });

  it('lets every rival finish without a fall at every level, on seeds 1, 7 and 42', () => {
    for (const [key, out] of results) {
      expect(out.times.every((t) => t != null), key).toBe(true);
      expect(out.falls, key).toEqual([0, 0, 0, 0, 0]);
    }
  });

  it('runs the rivals slower on EASY than on NORMAL, and slower on NORMAL than on HARD', () => {
    expect(mean('easy')).toBeGreaterThan(mean('normal'));
    expect(mean('normal')).toBeGreaterThan(mean('hard'));
  });
});

describe('the shortcuts of COMET RING (PRD 1775)', () => {
  it('never has a rival cross a gate, on seeds 1, 7 and 42: five rivals race three laps', () => {
    for (const seed of [1, 7, 42]) {
      let r = press(newRace({ seed }), 'start').race;
      for (let t = 0; t < RULES.countdown + 0.05; t += 0.05) r = step(r, NONE, 0.05).race;
      let crossed = 0, falls = 0;
      for (let t = 0; t < 600 && r.rivals.some((x) => x.doneAt == null); t += 1 / 60) {
        const before = r.rivals.map((x) => x.kart);
        const s = step(r, NONE, 1 / 60);
        r = s.race;
        r.rivals.forEach((x, i) => { if (crossedAnyGate(track, before[i] ?? x.kart, x.kart)) crossed++; });
        falls += s.events.filter((e) => e.kind === 'fell' && e.racer > 0).length;
      }
      expect(r.rivals.every((x) => x.doneAt != null), `seed ${seed}`).toBe(true);
      expect({ crossed, falls }, `seed ${seed}`).toEqual({ crossed: 0, falls: 0 });
    }
  });

  /** A lap driven in straight lines through the tiles `via` (centres), counted by the race's own rule: the pace at the end. */
  const lap = (via: readonly (readonly [number, number])[]) => {
    let pace = START_PACE;
    let from = { x: track.line.x - track.forward[0] * 40, y: track.line.y - track.forward[1] * 40 };
    for (const [tx, ty] of [...via, [38, 62] as const]) {
      const to = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
      const n = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4);
      for (let i = 1; i <= n; i++) {
        const p = { x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n };
        pace = advance(track, pace, i === 1 ? from : { x: from.x + ((to.x - from.x) * (i - 1)) / n, y: from.y + ((to.y - from.y) * (i - 1)) / n }, p);
      }
      from = to;
    }
    return pace;
  };
  const W = COMET_RING.waypoints;
  const wp = (...is: number[]): [number, number][] => is.map((i) => { const w = sure(W[i], 'a waypoint'); return [w[0], w[1]]; });
  const rest = wp(9, 10, 11, 12, 13);

  it('counts a lap driven on the main line', () => {
    expect(lap([...wp(0, 1, 2, 3, 4, 5, 6, 7, 8), ...rest])).toEqual({ laps: 1, passed: 0 });
  });

  it('counts a lap through the hidden ramp: its gate credits the two waypoints it skips', () => {
    expect(lap([...wp(0, 1), [62, 40], [62, 36], ...wp(4, 5, 6, 7, 8), ...rest])).toEqual({ laps: 1, passed: 0 });
  });

  it('counts a lap through the walkway: its gate credits the two waypoints it skips', () => {
    expect(lap([...wp(0, 1, 2, 3, 4, 5, 6), [34, 12], [26, 12], ...wp(9, 10, 11, 12, 13)])).toEqual({ laps: 1, passed: 0 });
  });

  it('counts a lap through both', () => {
    expect(lap([...wp(0, 1), [62, 40], [62, 36], ...wp(4, 5, 6), [34, 12], [26, 12], ...wp(9, 10, 11, 12, 13)])).toEqual({ laps: 1, passed: 0 });
  });
});

describe('the laps of a SINGLE race (PRD 1762, slice 4)', () => {
  const ahead = (laps: 3 | 5 | 7, done: number, clock: number): Race => {
    const r = play(started(newRace({ seed: 7, laps })), NONE, RULES.countdown + 0.05);
    const [fx, fy] = track.forward;
    const player: Race['player'] = { ...r.player, x: track.line.x - fx * 3, y: track.line.y - fy * 3, angle: track.heading, speed: 100, steer: 0 };
    return { ...r, clock, player, pace: { laps: done, passed: track.waypoints.length }, threeAt: done >= 3 ? 80 : null, finalAt: done >= laps - 1 ? 1 : null };
  };
  const run = (r: Race) => {
    let s = r;
    const events: RaceEvent[] = [];
    for (let i = 0; i < 40 && s.phase === 'race'; i++) { const o = step(s, GAS, 0.05); s = o.race; events.push(...o.events); }
    return { s, events };
  };

  it('races 3 laps when none is given, and counts the laps given on the HUD', () => {
    expect(fresh().laps).toBe(3);
    for (const laps of [3, 5, 7] as const) {
      const r = play(started(newRace({ seed: 7, laps })), NONE, RULES.countdown + 0.05);
      expect(r.laps).toBe(laps);
      expect(hudOf(r).run?.laps).toBe(laps);
    }
  });

  it('does not finish at the third crossing of a 5-lap race, and keeps the clock of that crossing', () => {
    const { s, events } = run(ahead(5, 2, 70));
    expect(s.phase).toBe('race');
    expect(s.pace.laps).toBe(3);
    expect(s.threeAt).not.toBeNull();
    expect(events.some((e) => e.kind === 'finish')).toBe(false);
    expect(hudOf(s).run?.lap).toBe(4);
  });

  it('shows FINAL LAP when the last lap of a 5-lap race begins, not before', () => {
    const early = play(started(newRace({ seed: 7, laps: 5 })), NONE, RULES.countdown + 0.05);
    expect(early.finalAt).toBeNull();
    const [fx, fy] = track.forward;
    const at = (done: number): Race => ({ ...early, clock: 90, player: { ...early.player, x: track.line.x - fx * 3, y: track.line.y - fy * 3, angle: track.heading, speed: 100, steer: 0 }, pace: { laps: done, passed: track.waypoints.length } });
    expect(run(at(2)).events.some((e) => e.kind === 'finalLap')).toBe(false);
    expect(run(at(3)).events.some((e) => e.kind === 'finalLap')).toBe(true);
  });

  it('finishes a 5-lap race at the fifth crossing, sending the clock of the third and listing the whole race', () => {
    const { s, events } = run(ahead(5, 4, 120));
    expect(s.phase).toBe('finish');
    expect(s.finish?.tenths).toBeGreaterThan(s.finish?.threeLap ?? 0);
    expect(s.finish?.threeLap).toBe(800);
    expect(events.filter((e) => e.kind === 'finish')).toEqual([{ kind: 'finish', tenths: 800 }]);
    expect(s.finish?.rows.find((x) => x.you)?.tenths).toBe(s.finish?.tenths);
  });

  it('sends today\'s race time in a 3-lap race', () => {
    const { s, events } = run(ahead(3, 2, 70));
    expect(s.phase).toBe('finish');
    expect(s.finish?.threeLap).toBe(s.finish?.tenths);
    expect(events.filter((e) => e.kind === 'finish')).toEqual([{ kind: 'finish', tenths: s.finish?.tenths }]);
  });

  it('counts the same laps for the rivals', () => {
    const base = ahead(5, 2, 70);
    const withRival = (laps: number): Race => ({ ...base, rivals: base.rivals.map((v, i) => (i === 0 ? { ...v, pace: { laps, passed: 0 } } : v)) });
    expect(step(withRival(3), NONE, 0.05).race.rivals[0]?.doneAt).toBeUndefined();
    expect(step(withRival(5), NONE, 0.05).race.rivals[0]?.doneAt).toBeDefined();
  });

  it('runs the difficulty it is given', () => {
    expect(newRace({ seed: 7, difficulty: 'hard' }).difficulty).toBe('hard');
  });
});

describe('the look a race carries (PRD 1762)', () => {
  it('carries the player\'s look, and none when it is not given', () => {
    expect(newRace({ seed: 1, look: { color: 'RED', design: 'RACER' } }).look).toEqual({ color: 'RED', design: 'RACER' });
    expect(newRace({ seed: 1 }).look).toBeUndefined();
  });

  it('leaves the rivals as they were: a driver without a look has none', () => {
    const race = newRace({ seed: 1, look: { color: 'RED', design: 'RACER' } });
    expect(race.rivals.every((r) => r.driver.look === undefined)).toBe(true);
  });
});
