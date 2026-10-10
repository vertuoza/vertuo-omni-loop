import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { hudOf, newRace, pause, press, scoreOf, step, type Race } from './race';
import { RULES } from './rules';
import { LAPS, PAR_SECONDS, parseTrack, TILE, tileAt } from './track';

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

  it('never carries a kart through a wall, a slow frame included', () => {
    let r = racing();
    for (let i = 0; i < 400; i++) {
      r = step(r, new Set<Action>(['a', i % 90 < 45 ? 'left' : 'right']), i % 7 === 0 ? 1 : 0.05).race;
      expect(tileAt(track.map, Math.floor(r.player.x / TILE), Math.floor(r.player.y / TILE)), `frame ${i}`).not.toBe('X');
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

describe('the finish and the score (slice 4)', () => {
  /** A race one step from the line: the player has done every lap but the last waypoints, just behind the start line. */
  function nearLine(rivals: (r: Race['rivals'][number], i: number) => Race['rivals'][number] = (r) => r): Race {
    const r = racing();
    const [fx, fy] = track.forward;
    const back = 3;
    const player = { ...r.player, x: track.line.x - fx * back, y: track.line.y - fy * back, angle: track.heading, speed: 100, steer: 0 };
    return { ...r, clock: 100, player, pace: { laps: LAPS - 1, passed: track.waypoints.length }, rivals: r.rivals.map(rivals) };
  }

  it('scores the place points plus a point per tenth of a second under the par time, and none at or over it', () => {
    expect([1, 2, 3, 4, 5, 6].map((p) => scoreOf(p, PAR_SECONDS))).toEqual([1000, 700, 500, 350, 200, 100]);
    expect(scoreOf(1, PAR_SECONDS - 12.3)).toBe(1123);
    expect(scoreOf(3, PAR_SECONDS + 20)).toBe(500);
    expect(scoreOf(6, 0)).toBe(100 + PAR_SECONDS * 10);
  });

  it('finishes when the player crosses the line at the end of lap 3, giving the score once', () => {
    let r = nearLine();
    const events = [];
    for (let i = 0; i < 20 && r.phase === 'race'; i++) { const s = step(r, GAS, 0.05); r = s.race; events.push(...s.events); }
    expect(r.phase).toBe('finish');
    const finishes = events.filter((e) => e.kind === 'finish');
    expect(finishes).toHaveLength(1);
    expect(finishes[0]).toEqual({ kind: 'finish', score: r.finish?.score });
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

  it('places the rivals still racing by progress, with no time, and scores the player\'s place', () => {
    const r = finished();
    const res = resultsOf(r);
    expect(res.rows.filter((x) => !x.you).every((x) => x.tenths === null)).toBe(true);
    expect(res.score).toBe(scoreOf(res.place, r.clock));
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

  it('gives no score to a player who quits from the pause before the line', () => {
    const p = press(pause(racing()), 'select');
    expect(p.events).toEqual([{ kind: 'quit' }]);
    expect(p.race.finish).toBeNull();
  });
});
