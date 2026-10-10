import { describe, expect, it } from 'vitest';
import { kartAt, type Kart } from './kart';
import { hudOf, newRace, placeOf, press, step, type Race } from './race';
import { advance, driveRival, lapOf, progressOf, pushApart, rivalTraits, rubber, START_PACE, type Driver, type Rival } from './rivals';
import { RULES } from './rules';
import { LAPS, PAR_SECONDS, parseTrack, TILE, tileAt } from './track';
import type { Action } from '../keys';

// The five rivals, the laps and the places (PRD 1359, slice 3).

const track = parseTrack();
const NONE: ReadonlySet<Action> = new Set();
const GAS: ReadonlySet<Action> = new Set<Action>(['a']);
const driver = (sprite: string): Driver => ({ sprite, tint: null, color: '#ff8800' });
const cast = ['beaver', 'octopod', 'picsou', 'cia', 'pirate'].map(driver);
const nth = <T>(xs: readonly T[], i: number): T => {
  const x = xs[i];
  if (x === undefined) throw new Error(`no item ${i}`);
  return x;
};
const first = <T>(xs: readonly T[]): T => nth(xs, 0);
const apart = (a: Kart, b: Kart) => Math.hypot(a.x - b.x, a.y - b.y);

/** Plays `seconds` in 50 ms frames, as the arcade's loop does. */
function play(race: Race, held: ReadonlySet<Action>, seconds: number, dt = 0.05): Race {
  let r = race;
  for (let t = 0; t < seconds - 1e-9; t += dt) r = step(r, held, dt).race;
  return r;
}
const racing = (seed = 7, c: readonly Driver[] = cast) => play(press(newRace({ seed, cast: c }), 'start').race, NONE, RULES.countdown + 0.05);

describe('the grid', () => {
  it('stands six karts on the six starting places, the player on the last, all facing the way the line runs, at rest', () => {
    const r = newRace({ seed: 1, cast });
    expect(r.rivals).toHaveLength(5);
    r.rivals.forEach((rival, i) => {
      expect([rival.kart.x, rival.kart.y]).toEqual([track.places[i]?.x, track.places[i]?.y]);
      expect(rival.kart.angle).toBe(track.heading);
      expect(rival.kart.speed).toBe(0);
    });
    expect([r.player.x, r.player.y]).toEqual([track.places[5]?.x, track.places[5]?.y]);
  });

  it('drives each rival with a driver of the cast, in order', () => {
    expect(newRace({ seed: 1, cast }).rivals.map((r) => r.driver.sprite)).toEqual(['beaver', 'octopod', 'picsou', 'cia', 'pirate']);
  });

  it('fills the empty places with the next mascots no rival drives yet', () => {
    const r = newRace({ seed: 1, cast: [driver('octopod'), driver('beaver')] });
    expect(r.rivals.map((x) => x.driver.sprite)).toEqual(['octopod', 'beaver', 'picsou', 'cia', 'pirate']);
    expect(newRace({ seed: 1 }).rivals.map((x) => x.driver.sprite)).toEqual(['beaver', 'octopod', 'picsou', 'cia', 'pirate']);
  });

  it('never puts more than five rivals on the grid', () => {
    const many = ['beaver', 'octopod', 'picsou', 'cia', 'pirate', 'shark', 'turtle'].map(driver);
    expect(newRace({ seed: 1, cast: many }).rivals.map((x) => x.driver.sprite)).toEqual(['beaver', 'octopod', 'picsou', 'cia', 'pirate']);
  });

  it('keeps the rivals still until GO, and the player on the last place', () => {
    const r = play(press(newRace({ seed: 1, cast }), 'start').race, NONE, 2);
    expect(r.rivals.every((x) => x.kart.speed === 0)).toBe(true);
    expect(placeOf(newRace({ seed: 1, cast }))).toBe(6);
  });
});

describe('the rivals\' skill', () => {
  it('draws each rival\'s top speed between 92% and 100% of the player\'s, and a small offset from the line, from the seed', () => {
    const traits = rivalTraits(1359, 50);
    for (const t of traits) {
      expect(t.skill).toBeGreaterThanOrEqual(0.92);
      expect(t.skill).toBeLessThanOrEqual(1);
      expect(Math.abs(t.offset)).toBeLessThanOrEqual(RULES.lineOffset);
    }
    expect(new Set(traits.map((t) => t.skill)).size).toBeGreaterThan(40);
    expect(rivalTraits(1359, 5)).toEqual(rivalTraits(1359, 5));
    expect(rivalTraits(1360, 5)).not.toEqual(rivalTraits(1359, 5));
  });

  it('moves a rival\'s pace by at most 5%: up when it is behind the player, down when it is far ahead', () => {
    expect(rubber(0, 10_000)).toBeCloseTo(1.05, 10);
    expect(rubber(10_000, 0)).toBeCloseTo(0.95, 10);
    expect(rubber(500, 500)).toBe(1);
    expect(rubber(400, 500)).toBeGreaterThan(1);
    expect(rubber(500, 400)).toBeLessThan(1);
    for (const gap of [-1e9, -300, 0, 120, 1e9]) expect(Math.abs(rubber(0, gap) - 1)).toBeLessThanOrEqual(0.05 + 1e-12);
  });

  it('never makes a rival faster than the band allows over the player\'s top speed', () => {
    const r = play(racing(), NONE, 30);
    for (const rival of r.rivals) expect(rival.kart.speed).toBeLessThanOrEqual(RULES.topSpeed * 1.05 + 1e-9);
  });
});

/** A rival alone on the circuit: the band is neutral because the "player" is exactly as far along. */
function alone(skill: number, offset: number, seconds: number): number | null {
  const start = first(track.places);
  let rival: Rival = { driver: driver('beaver'), kart: kartAt(start.x, start.y, track.heading), pace: START_PACE, skill, offset };
  const dt = RULES.subStep;
  for (let t = 0; t < seconds; t += dt) {
    rival = driveRival(track, rival, dt, progressOf(track, rival.pace, rival.kart));
    if (rival.pace.laps >= LAPS) return t;
  }
  return null;
}

describe('a rival alone on COMET RING', () => {
  it.each([[0.92, -RULES.lineOffset], [0.92, RULES.lineOffset], [1, 0], [0.96, 7]] as const)('completes three laps within twice the par time (skill %s, off the line by %s)', (skill, offset) => {
    const time = alone(skill, offset, PAR_SECONDS * 2);
    expect(time).not.toBeNull();
    expect(time ?? Infinity).toBeLessThan(PAR_SECONDS * 2);
  });
});

describe('laps', () => {
  const here = (x: number, y: number) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
  const done = { laps: 0, passed: track.waypoints.length };
  const before = { x: track.line.x - 4, y: track.line.y };
  const after = { x: track.line.x + 4, y: track.line.y };

  it('counts a lap when the kart crosses the start line forwards after every waypoint', () => {
    expect(advance(track, done, before, after)).toEqual({ laps: 1, passed: 0 });
  });

  it('counts nothing backwards over the line', () => {
    expect(advance(track, done, after, before)).toEqual(done);
  });

  it('counts nothing when a waypoint was skipped', () => {
    const skipped = { laps: 0, passed: track.waypoints.length - 1 };
    expect(advance(track, skipped, before, after)).toEqual(skipped);
    expect(advance(track, START_PACE, before, after)).toEqual(START_PACE);
  });

  it('passes the waypoints in order only: the next one, within reach', () => {
    const w0 = first(track.waypoints), w1 = track.waypoints[1];
    expect(advance(track, START_PACE, here(0, 0), { x: w1?.x ?? 0, y: w1?.y ?? 0 })).toEqual(START_PACE);
    expect(advance(track, START_PACE, here(0, 0), { x: w0.x + RULES.waypointReach - 1, y: w0.y })).toEqual({ laps: 0, passed: 1 });
    expect(advance(track, START_PACE, here(0, 0), { x: w0.x + RULES.waypointReach + 1, y: w0.y })).toEqual(START_PACE);
  });

  // A person cuts a corner wherever the road lets them: tight on the inside, or over the grass inside.
  // Each way is a path through every corner, from the pole over the line, walked a pixel at a time; no
  // step of it is in a wall.
  type Point = { x: number; y: number };
  const unit = (a: Point, b: Point): Point => { const l = Math.hypot(b.x - a.x, b.y - a.y); return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
  const corners = track.waypoints.map((w, i) => ({
    w,
    into: unit(i === 0 ? track.line : nth(track.waypoints, i - 1), w),
    out: unit(w, i === track.waypoints.length - 1 ? track.line : nth(track.waypoints, i + 1)),
  }));
  type Corner = (typeof corners)[number];
  /** The corner's waypoint moved `k` along the way in and `j` along the way out. */
  const off = (c: Corner, k: number, j: number): Point => ({ x: c.w.x + c.into.x * k + c.out.x * j, y: c.w.y + c.into.y * k + c.out.y * j });
  function lapOn(way: (c: Corner) => Point[]) {
    const path = [nth(track.places, 0), ...corners.flatMap(way), { x: track.line.x + 2 * TILE, y: track.line.y }];
    let pace = START_PACE;
    const walls: Point[] = [];
    path.slice(1).forEach((b, i) => {
      const a = nth(path, i);
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
      for (let s = 0; s < steps; s++) {
        const from = { x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps };
        const to = { x: a.x + ((b.x - a.x) * (s + 1)) / steps, y: a.y + ((b.y - a.y) * (s + 1)) / steps };
        pace = advance(track, pace, from, to);
        if (tileAt(track.map, Math.floor(to.x / TILE), Math.floor(to.y / TILE)) === 'X') walls.push(to);
      }
    });
    return { pace, walls };
  }

  it.each([
    ['tight on the inside', (c: Corner) => [off(c, -32, 32)]],
    ['cut over the grass inside', (c: Corner) => [off(c, -55, 35), off(c, -35, 55)]],
  ])('counts a lap when every corner is taken %s', (_, way) => {
    expect(lapOn(way)).toEqual({ pace: { laps: 1, passed: 0 }, walls: [] });
  });

  it('passes a waypoint whose corner\'s diagonal is crossed forwards near it, not backwards nor far from it', () => {
    const c = first(corners);
    // The diagonal is where the way in and the way out are as far: off(c, t, -t).
    const near = (t: number) => [off(c, t - 2, -t - 2), off(c, t + 2, -t + 2)] as const;
    const [from, to] = near(-60);
    expect(Math.hypot(to.x - c.w.x, to.y - c.w.y)).toBeGreaterThan(RULES.waypointReach);
    expect(advance(track, START_PACE, from, to)).toEqual({ laps: 0, passed: 1 });
    expect(advance(track, START_PACE, to, from)).toEqual(START_PACE);
    const [farFrom, farTo] = near(-(RULES.cornerGate / Math.SQRT2 + 2));
    expect(advance(track, START_PACE, farFrom, farTo)).toEqual(START_PACE);
  });

  it('counts a lap once, not at every step across the line', () => {
    const once = advance(track, done, before, after);
    expect(advance(track, once, before, after)).toEqual(once);
  });

  it('shows the lap being raced, 1 to 3, and stays on the third', () => {
    expect([0, 1, 2, 3, 4].map((laps) => lapOf({ laps, passed: 0 }))).toEqual([1, 2, 3, 3, 3]);
  });

  it('counts the player\'s laps in the race: none at the start, for the line it starts behind', () => {
    const r = play(racing(), GAS, 1.5);
    expect(r.pace.laps).toBe(0);
    expect(hudOf(r).run?.lap).toBe(1);
  });
});

describe('places', () => {
  it('follows progress along the racing line, whole laps first', () => {
    const p = (laps: number, passed: number, where: { x: number; y: number }) => progressOf(track, { laps, passed }, where);
    const w0 = first(track.waypoints);
    expect(p(0, 0, track.line)).toBeCloseTo(0, 6);
    expect(p(0, 1, w0)).toBeGreaterThanOrEqual(p(0, 0, w0));
    expect(p(0, 2, w0)).toBeGreaterThan(p(0, 1, w0));
    expect(p(0, 0, { x: track.line.x - 40, y: track.line.y })).toBeLessThan(0);
    expect(p(1, 0, track.line)).toBeGreaterThanOrEqual(p(0, 14, track.line));
    expect(p(1, 0, track.line)).toBeGreaterThan(p(0, 13, first(track.waypoints)));
    expect(p(0, 1, { x: w0.x, y: w0.y - 20 })).toBeGreaterThan(p(0, 1, w0));
  });

  it('puts the player in the place its progress earns: last on the grid, first when it leads every rival', () => {
    const r = newRace({ seed: 1, cast });
    expect(placeOf(r)).toBe(6);
    expect(placeOf({ ...r, pace: { laps: 1, passed: 0 } })).toBe(1);
    const third: Race = { ...r, rivals: r.rivals.map((x, i) => (i < 2 ? { ...x, pace: { laps: 1, passed: 0 } } : x)), pace: { laps: 0, passed: 2 } };
    expect(placeOf(third)).toBe(3);
  });

  it('lets the rivals pull away from a player who does not move: the player ends last, and the HUD says so', () => {
    const r = play(racing(), NONE, 20);
    expect(placeOf(r)).toBe(6);
    expect(hudOf(r).run).toMatchObject({ place: 6, lap: 1, laps: 3, final: false });
  });
});

/** The smallest distance between any two of the karts. */
function closestPair(karts: readonly Kart[]): number {
  const gaps = karts.flatMap((a, i) => karts.slice(i + 1).map((b) => apart(a, b)));
  return Math.min(...gaps);
}

describe('karts touching', () => {
  const at = (x: number, y: number): Kart => kartAt(x, y, 0);

  it('pushes two touching karts apart, as two circles, each by half of the overlap', () => {
    const pushed = pushApart([at(100, 100), at(104, 100)]);
    const a = nth(pushed, 0), b = nth(pushed, 1);
    expect(apart(a, b)).toBeCloseTo(RULES.radius * 2, 10);
    expect(a.x).toBeCloseTo(97, 10);
    expect(b.x).toBeCloseTo(107, 10);
    expect([a.y, b.y]).toEqual([100, 100]);
  });

  it('leaves karts that do not touch alone, and pushes two on the same spot apart all the same', () => {
    const karts = [at(100, 100), at(111, 100)];
    expect(pushApart(karts)).toEqual(karts);
    const [a, b] = pushApart([at(100, 100), at(100, 100)]);
    expect(a).not.toEqual(b);
  });

  it('keeps the karts of a race from sitting inside each other', () => {
    let r = racing();
    let closest = Infinity;
    for (let i = 0; i < 400; i++) {
      r = step(r, GAS, 0.05).race;
      closest = Math.min(closest, closestPair([r.player, ...r.rivals.map((x) => x.kart)]));
    }
    expect(closest).toBeGreaterThan(RULES.radius * 2 - 1.5);
  });
});

describe('the race with five rivals', () => {
  it('is the same race for the same seed and inputs, and another for another seed', () => {
    const run = (seed: number) => play(racing(seed), GAS, 10).rivals.map((r) => [r.kart.x, r.kart.y]);
    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(4));
  });

  it('lets all five rivals finish three laps within twice the par time, pushing past each other and the player', () => {
    let r = press(newRace({ seed: 11, cast }), 'start').race;
    for (let t = 0; t < PAR_SECONDS * 2 && !r.rivals.every((v) => v.pace.laps >= LAPS); t += 0.05) r = step(r, GAS, 0.05).race;
    expect(r.rivals.map((v) => v.pace.laps)).toEqual([LAPS, LAPS, LAPS, LAPS, LAPS]);
  });

  it('shows FINAL LAP for a moment when the player\'s third lap starts', () => {
    const third: Race = { ...racing(), pace: { laps: 2, passed: 0 }, finalAt: null };
    const next = step(third, NONE, 0.05).race;
    expect(next.finalAt).toBe(next.clock);
    expect(hudOf(next).run?.final).toBe(true);
    expect(hudOf({ ...next, clock: next.clock + RULES.finalBanner + 0.1 }).run?.final).toBe(false);
    expect(hudOf(next).run?.lap).toBe(3);
  });

  it('reads the race time in tenths, and shows nothing of the race before GO', () => {
    const r = play(racing(), NONE, 1.25);
    expect(hudOf(r).run?.tenths).toBe(Math.floor(r.clock * 10 + 1e-9));
    expect(hudOf(newRace({ seed: 1 })).run).toBeUndefined();
    expect(hudOf(press(newRace({ seed: 1 }), 'start').race).run).toBeUndefined();
  });
});
