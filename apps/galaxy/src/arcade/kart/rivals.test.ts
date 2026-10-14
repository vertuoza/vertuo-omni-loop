import { describe, expect, it } from 'vitest';
import { kartAt, leanOf, NO_FX, type Fx, type Kart } from './kart';
import { hudOf, newRace, placeOf, press, step, type Race } from './race';
import { advance, aimOf, crossedAnyGate, comeBack, driveRival, lapOf, progressOf, pushApart, rivalTraits, rubber, START_PACE, type Driver, type Rival } from './rivals';
import { RULES } from './rules';
import { crossings } from './line';
import { carryAlong, COMET_RING, crosses, LAPS, cornersOf, groundOf, locatePx, parseTrack, pointAtPx, roadAt, TILE } from './track';
import { EIGHT, withFloor } from './track.fake';

/** The longest a rival's three laps are given in these tests, in seconds. */
const LIMIT_SECONDS = 150;
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

describe('the rivals\' levels (PRD 1762)', () => {
  it('holds today\'s numbers in NORMAL', () => {
    expect(RULES.levels.normal).toEqual({ skillMin: RULES.skillMin, skillMax: 1, lineOffset: RULES.lineOffset, rubber: RULES.rubber, hold: 0 });
    expect(rivalTraits(1359, 5, 'normal')).toEqual(rivalTraits(1359, 5));
  });

  it('keeps a rival\'s own pace at no more than the player\'s top speed, at every level', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      for (const t of rivalTraits(1359, 50, level)) {
        expect(t.skill).toBeLessThanOrEqual(1);
        expect(t.skill).toBeGreaterThanOrEqual(RULES.levels[level].skillMin);
        expect(Math.abs(t.offset)).toBeLessThanOrEqual(RULES.levels[level].lineOffset);
      }
    }
  });

  it('orders the levels: EASY slower than NORMAL, HARD faster and on a tighter line', () => {
    expect(RULES.levels.easy.skillMax).toBeLessThan(RULES.levels.normal.skillMin);
    expect(RULES.levels.hard.skillMin).toBeGreaterThan(RULES.levels.normal.skillMin);
    expect(RULES.levels.hard.lineOffset).toBeLessThan(RULES.levels.normal.lineOffset);
  });

  it('moves the rubber band by the level\'s share', () => {
    expect(rubber(0, 1e6, 'easy')).toBeCloseTo(1 + RULES.levels.easy.rubber);
    expect(rubber(0, 1e6, 'hard')).toBeCloseTo(1 + RULES.levels.hard.rubber);
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

  it('never makes a rival faster than the band allows over the player\'s top speed, a BOOST from a box apart', () => {
    // Forty boxes: a rival takes a BOOST within 30 seconds, which lifts its top speed by `boostFactor`.
    const r = play(racing(), NONE, 30);
    for (const rival of r.rivals) expect(rival.kart.speed).toBeLessThanOrEqual(RULES.topSpeed * 1.05 * RULES.boostFactor + 1e-9);
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
    const time = alone(skill, offset, LIMIT_SECONDS * 2);
    expect(time).not.toBeNull();
    expect(time ?? Infinity).toBeLessThan(LIMIT_SECONDS * 2);
  });
});

describe('laps', () => {
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

  const gate = (i: number) => nth(track.gates, i);
  /** A point on the line normal to the centre line at the gate, `side` of the road's half-width from its middle, `ahead` px along the way it runs. */
  const onGate = (i: number, side: number, ahead: number) => {
    const g = gate(i);
    const half = Math.hypot(g.bx - g.ax, g.by - g.ay) / 2;
    return { x: g.x - g.ty * side * half + g.tx * ahead, y: g.y + g.tx * side * half + g.ty * ahead };
  };

  it('passes the gates in order only: the next one, crossed forwards', () => {
    expect(advance(track, START_PACE, onGate(1, 0, -4), onGate(1, 0, 4))).toEqual(START_PACE);
    expect(advance(track, START_PACE, onGate(0, 0, -4), onGate(0, 0, 4))).toEqual({ laps: 0, passed: 1 });
    expect(advance(track, { laps: 0, passed: 1 }, onGate(1, 0, -4), onGate(1, 0, 4))).toEqual({ laps: 0, passed: 2 });
  });

  it('passes a waypoint at the middle of its arc: the gate is the line across the road there, crossed forwards, not backwards nor beside the road', () => {
    for (const [i, c] of cornersOf(track).entries()) {
      const g = nth(track.gates.filter((x) => x.index === c.index), 0);
      const at = pointAtPx(track, c.start * TILE + (c.length * TILE) / 2);
      expect(Math.hypot(g.x - at.x, g.y - at.y), `corner ${i}`).toBeLessThan(1);
    }
    expect(advance(track, START_PACE, onGate(0, 0, 4), onGate(0, 0, -4))).toEqual(START_PACE);
    expect(advance(track, START_PACE, onGate(0, 3, -4), onGate(0, 3, 4))).toEqual(START_PACE);
  });

  // A person cuts a corner wherever the road lets them: tight on the inside, or out wide. Each way is a path through every gate, from the pole over the line, walked a pixel at a time.
  function lapOn(side: number) {
    const path = [nth(track.places, 0), ...track.gates.map((_, i) => onGate(i, side, 0)), { x: track.line.x + 2 * TILE, y: track.line.y }];
    let pace = START_PACE;
    path.slice(1).forEach((b, i) => {
      const a = nth(path, i);
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
      for (let k = 0; k < steps; k++) {
        const from = { x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps };
        const to = { x: a.x + ((b.x - a.x) * (k + 1)) / steps, y: a.y + ((b.y - a.y) * (k + 1)) / steps };
        pace = advance(track, pace, from, to);
      }
    });
    return pace;
  }

  it.each([['on the inside', -0.7], ['in the middle', 0], ['out wide', 0.7]])('counts a lap when every corner is taken %s', (_, side) => {
    expect(lapOn(side)).toEqual({ laps: 1, passed: 0 });
  });

  it('counts a lap once, not at every step across the line', () => {
    const once = advance(track, done, before, after);
    expect(advance(track, once, before, after)).toEqual(once);
  });

  it('shows the lap being raced, 1 to 3, and stays on the third', () => {
    expect([0, 1, 2, 3, 4].map((laps) => lapOf({ laps, passed: 0 }))).toEqual([1, 2, 3, 3, 3]);
    expect([0, 1, 4, 5, 6].map((laps) => lapOf({ laps, passed: 0 }, 5))).toEqual([1, 2, 5, 5, 5]);
  });

  it('counts the player\'s laps in the race: none at the start, for the line it starts behind', () => {
    const r = play(racing(), GAS, 1.5);
    expect(r.pace.laps).toBe(0);
    expect(hudOf(r).run?.lap).toBe(1);
  });
});

describe('shortcut gates (PRD 1775)', () => {
  // The hidden ramp's leg runs north from [62.5, 46.5] to [62.5, 34.5], its gate across it at row 36.5, skipping waypoints 2 and 3.
  const n = track.waypoints.length;
  const at36 = (dy: number, x = 62.5) => ({ x: x * TILE, y: 36.5 * TILE + dy });

  it('credits the two waypoints when the gate is crossed forwards and the first of them is the next to pass', () => {
    expect(advance(track, { laps: 0, passed: 2 }, at36(4), at36(-4))).toEqual({ laps: 0, passed: 4 });
  });

  it('lets the lap count at the line after a gate that skipped the last two waypoints', () => {
    const last = parseTrack({ ...COMET_RING, shortcuts: [{ leg: [[21.5, 50], [21.5, 58]], gate: [[19, 54], [24, 54]], skips: n - 2 }] });
    const across = (dy: number) => ({ x: 21.5 * TILE, y: 54 * TILE + dy });
    const pace = advance(last, { laps: 0, passed: n - 2 }, across(-4), across(4));
    expect(pace).toEqual({ laps: 0, passed: n });
    const before = { x: last.line.x - 4, y: last.line.y }, after = { x: last.line.x + 4, y: last.line.y };
    expect(advance(last, pace, before, after)).toEqual({ laps: 1, passed: 0 });
  });

  it('credits nothing backwards, nor with another waypoint next', () => {
    expect(advance(track, { laps: 0, passed: 2 }, at36(-4), at36(4))).toEqual({ laps: 0, passed: 2 });
    for (const passed of [0, 1, 3, 4]) expect(advance(track, { laps: 0, passed }, at36(4), at36(-4))).toEqual({ laps: 0, passed });
  });

  it('credits nothing to a kart that crosses beside the gate', () => {
    expect(advance(track, { laps: 0, passed: 2 }, at36(4, 58.5), at36(-4, 58.5))).toEqual({ laps: 0, passed: 2 });
  });

  it('gives no waypoint to a lap that leaves the racing line anywhere but at a shortcut', () => {
    const away = { x: 30 * TILE, y: 30 * TILE };
    expect(advance(track, { laps: 0, passed: 2 }, away, { x: away.x + 20, y: away.y })).toEqual({ laps: 0, passed: 2 });
  });

  it('never has a rival take the gate: five rivals race without crossing a gate beside their line', () => {
    let race = racing(7);
    let crossed = false;
    for (let t = 0; t < 40 && !crossed; t += 0.05) {
      const before = race.rivals.map((r) => r.kart);
      race = play(race, GAS, 0.05);
      crossed = race.rivals.some((r, i) => crossedAnyGate(track, before[i] ?? r.kart, r.kart));
    }
    expect(crossed).toBe(false);
  });
});

describe('a rival and the gap ahead of a ramp (PRD 1775)', () => {
  const lane = 2 * TILE;
  // A road two tiles wide, a gap in its north half only: a kart on the seam has one wheel over the gap.
  const gap = ['~'.repeat(40), '#'.repeat(14) + '^' + '~'.repeat(3) + '#'.repeat(22), '#'.repeat(14) + '^' + '#'.repeat(25), '~'.repeat(40)];
  const noRamp = ['~'.repeat(40), '#'.repeat(14) + '#' + '~'.repeat(3) + '#'.repeat(22), '#'.repeat(40), '~'.repeat(40)];
  const rival = (x: number): Rival => ({ driver: driver('beaver'), kart: { ...kartAt(x, lane, 0), speed: 100 }, pace: START_PACE, skill: 1, offset: 0 });
  const speedAfter = (map: readonly string[], x: number) => driveRival({ ...track, ...groundOf(map) }, rival(x), RULES.subStep, 0).kart.speed;

  it('does not brake for the void beyond a ramp it is driving at, as it does for a void beyond plain road', () => {
    const x = 13.5 * TILE;
    expect(speedAfter(gap, x)).toBeGreaterThan(speedAfter(noRamp, x));
  });

  it('does not brake in the air over the void', () => {
    const flying: Rival = { ...rival(15.5 * TILE), kart: { ...kartAt(15.5 * TILE, lane, 0), speed: 100, height: 8, lift: 20 } };
    expect(driveRival({ ...track, ...groundOf(gap) }, flying, RULES.subStep, 0).kart.speed).toBe(100);
  });
});

describe('places', () => {
  it('follows progress along the racing line, whole laps first', () => {
    const p = (laps: number, passed: number, where: { x: number; y: number }) => progressOf(track, { laps, passed }, where);
    const g0 = nth(track.gates, 0), last = nth(track.gates, track.gates.length - 1);
    const past = pointAtPx(track, g0.along + 20);
    expect(p(0, 0, track.line)).toBeCloseTo(0, 6);
    expect(p(0, 0, g0)).toBeGreaterThan(0);
    expect(p(0, 0, { x: track.line.x - 40, y: track.line.y })).toBeLessThan(0);
    expect(p(1, 0, track.line)).toBeGreaterThanOrEqual(p(0, track.gates.length, track.line));
    expect(p(1, 0, track.line)).toBeGreaterThan(p(0, track.gates.length - 1, last));
    expect(p(0, 1, past)).toBeGreaterThan(p(0, 1, g0));
  });

  it('puts the player in the place its progress earns: last on the grid, first when it leads every rival', () => {
    const r = newRace({ seed: 1, cast });
    expect(placeOf(r)).toBe(6);
    expect(placeOf({ ...r, pace: { laps: 1, passed: 0 } })).toBe(1);
    const g2 = nth(track.gates, 2);
    const third: Race = { ...r, rivals: r.rivals.map((x, i) => (i < 2 ? { ...x, pace: { laps: 1, passed: 0 } } : x)), pace: { laps: 0, passed: 2 }, player: { ...r.player, x: g2.x, y: g2.y } };
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
    for (let t = 0; t < LIMIT_SECONDS * 2 && !r.rivals.every((v) => v.pace.laps >= LAPS); t += 0.05) r = step(r, GAS, 0.05).race;
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

// The way back after a fall into the void (PRD 1447, slice 2).
describe('the way back', () => {
  const fell = (x: number, y: number): Kart => ({ ...kartAt(x, y, 1), speed: 50 });
  const down: Fx = { ...NO_FX, item: 'blob', fall: 0.001 };
  const mod = (a: number, m: number) => ((a % m) + m) % m;
  /** Where a point of the road lies along a lap, in px from the start line. */
  const relOf = (p: { x: number; y: number }) => mod(locatePx(track, p.x, p.y).along - track.startAlong, track.length);
  const gateRel = (i: number) => mod(nth(track.gates, i).along - track.startAlong, track.length);

  it('is the nearest point of the segment the kart is measured along, on a straight, facing the way of the segment, at rest', () => {
    // The start straight runs east to the gate of waypoint 0; the kart falls off its north edge.
    const back = comeBack(track, { laps: 1, passed: 0 }, fell(45 * TILE, 56 * TILE), down);
    expect(back.kart.x).toBeCloseTo(45 * TILE, 6);
    expect(back.kart.y).toBeCloseTo(62.5 * TILE, 6);
    expect(back.kart.speed).toBe(0);
    expect(back.kart.steer).toBe(0);
    expect(Math.cos(back.kart.angle)).toBeCloseTo(1, 6);
    expect(back.fx).toEqual({ item: 'blob', boost: 0, spin: 0, fall: 0, blink: RULES.blinkTime, tip: 0 });
  });

  it('is the nearest point in a corner too: on the segment it is on, not on the next one', () => {
    // Heading north up the leg to waypoint 1, the kart fell off past the inside.
    const back = comeBack(track, { laps: 0, passed: 1 }, fell(62.5 * TILE - 70, 52 * TILE), down);
    expect(back.kart.x).toBeCloseTo(62.5 * TILE, 6);
    expect(back.kart.y).toBeCloseTo(52 * TILE, 6);
    expect(Math.sin(back.kart.angle)).toBeCloseTo(-1, 6);
  });

  it('never goes beyond the segment\'s ends: not past the next gate, not before the last one', () => {
    const g = nth(track.gates, 1);
    const far = comeBack(track, { laps: 0, passed: 1 }, fell(g.x + g.tx * 300, g.y + g.ty * 300), down).kart;
    expect(relOf(far)).toBeLessThan(gateRel(1));
    expect(relOf(far)).toBeGreaterThan(gateRel(0));
    const behind = comeBack(track, { laps: 0, passed: 1 }, fell(g.x - g.tx * 600, g.y - g.ty * 600), down).kart;
    expect(relOf(behind)).toBeGreaterThanOrEqual(gateRel(0) - 1e-6);
  });

  it('never goes across the start line: the last segment ends short of it', () => {
    const n = track.gates.length;
    const before = (k: { x: number; y: number }) => k.x * track.forward[0] + k.y * track.forward[1] - track.line.at;
    const back = comeBack(track, { laps: 1, passed: n }, fell(track.line.x + 60 * track.forward[0], track.line.y + 60 * track.forward[1]), down).kart;
    expect(before(back)).toBeLessThan(0);
  });

  it('keeps the pace: a rival whose fall ends comes back and its laps and waypoints are the ones it had', () => {
    const rival: Rival = { driver: driver('beaver'), kart: fell(45 * TILE, 57 * TILE), pace: { laps: 1, passed: 0 }, skill: 1, offset: 0, fx: { ...NO_FX, fall: 0.001 } };
    const next = driveRival(track, rival, 0.01, 0);
    expect(next.pace).toEqual({ laps: 1, passed: 0 });
    expect(next.kart.speed).toBe(0);
    expect(next.kart.y).toBeCloseTo(62.5 * TILE, 6);
    expect(next.fx?.fall).toBe(0);
    expect(next.fx?.blink).toBe(RULES.blinkTime);
  });

  it('is never over the void', () => {
    track.gates.forEach((g, i) => {
      const back = comeBack(track, { laps: 0, passed: i }, fell(g.x + 3, g.y + 3), down).kart;
      expect(roadAt(track, back.x, back.y), `gate ${i}`).toBe(true);
    });
  });

  it('is never over the void, wherever on the racing line the kart fell: every point of the lap, not only at the gates (the guard of bug 1820)', () => {
    const over: string[] = [];
    for (let s = 0; s < track.length; s += 4) {
      const p = pointAtPx(track, track.startAlong + s);
      const passed = track.gates.filter((_, i) => gateRel(i) <= s).length;
      const back = comeBack(track, { laps: 0, passed }, fell(p.x, p.y), down).kart;
      if (!roadAt(track, back.x, back.y)) over.push(`${s} along`);
    }
    expect(over).toEqual([]);
  });

  it('is never over the void where the racing line crosses the gap jump: it is before the ramp, a run-up behind the gap, at rest (bug 1820)', () => {
    for (const row of [19.5, 20.5, 21.5]) {
      const back = comeBack(track, { laps: 0, passed: 5 }, fell(64.5 * TILE, row * TILE), down).kart;
      expect(roadAt(track, back.x, back.y), `row ${row}`).toBe(true);
      expect(back.y, `row ${row}`).toBeGreaterThan(23 * TILE);
      expect(back.speed).toBe(0);
      expect(Math.sin(back.angle)).toBeCloseTo(-1, 6);
    }
  });

  it('brings the slowest rival that fell into the gap jump back where it clears it (bug 1820)', () => {
    let rival: Rival = { driver: driver('beaver'), kart: fell(64.5 * TILE, 21 * TILE), pace: { laps: 0, passed: 5 }, skill: RULES.levels.easy.skillMin, offset: 0, fx: { ...NO_FX, fall: 0.001 } };
    let falls = 0;
    for (let t = 0; t < 8 && rival.kart.y > 17 * TILE; t += RULES.subStep) {
      const was = (rival.fx ?? NO_FX).fall > 0;
      rival = driveRival(track, rival, RULES.subStep, progressOf(track, rival.pace, rival.kart));
      if ((rival.fx ?? NO_FX).fall > 0 && !was) falls++;
    }
    expect(falls).toBe(0);
    expect(rival.kart.y).toBeLessThan(17 * TILE);
  });
});

describe('a falling rival', () => {
  it('falls when it drives over the void, and is out of the contacts', () => {
    const rival: Rival = { driver: driver('beaver'), kart: { ...kartAt(40 * TILE + 8, 60 * TILE + 3, -Math.PI / 2), speed: 80 }, pace: { laps: 0, passed: 0 }, skill: 1, offset: 0, fx: NO_FX };
    let r = rival;
    for (let i = 0; i < 100 && (r.fx?.fall ?? 0) <= 0; i++) r = driveRival(track, r, 1 / 120, 0);
    expect(r.fx?.fall).toBe(RULES.fallTime);
    expect(r.kart.speed).toBe(0);
    const kept = pushApart([r.kart, { ...r.kart }], [true, false]);
    expect(kept[0]).toEqual(r.kart);
    expect(kept[1]).toEqual(r.kart);
  });
});

describe('a rival on a hill (PRD 1698)', () => {
  // The start straight runs east from waypoint 13 to waypoint 0; a hump of 26 at its middle climbs and falls along it.
  const n = track.waypoints.length;
  const zero = Array.from({ length: n }, () => 0);
  const level = parseTrack({ ...COMET_RING, relief: { heights: zero, bumps: zero } });
  const hump = parseTrack({ ...COMET_RING, relief: { heights: zero, bumps: zero.map((_, i) => (i === n - 1 ? 26 : 0)) } });
  const a = nth(hump.waypoints, n - 1);
  /** The speed of a rival at full tilt, `d` tiles along the straight (past the pads of its first tiles), after half a second. */
  const speedAt = (on: typeof hump, d: number): number => {
    let rival: Rival = { driver: driver('beaver'), kart: { ...kartAt(a.x + d * TILE, a.y, 0), speed: RULES.topSpeed }, pace: START_PACE, skill: 1, offset: 0 };
    for (let t = 0; t < 0.5; t += RULES.subStep) rival = driveRival(on, rival, RULES.subStep, progressOf(on, rival.pace, rival.kart));
    return rival.kart.speed;
  };

  it('is slower going up the hill than on the flat, and faster coming down, within 0.67 and 1.33 of it', () => {
    const flat = speedAt(level, 8);
    expect(flat).toBeCloseTo(RULES.topSpeed, 0);
    const up = speedAt(hump, 8), down = speedAt(hump, 20);
    expect(up).toBeLessThan(flat * 0.95);
    expect(down).toBeGreaterThan(flat * 1.05);
    expect(up).toBeGreaterThanOrEqual(flat * 0.67 - 1e-9);
    expect(down).toBeLessThanOrEqual(flat * 1.33 + 1e-9);
  });
});

describe('a rival follows the arcs of the centre line (PRD 1829)', () => {
  const rivalAt = (kart: Kart, passed: number, offset = 0): Rival => ({ driver: driver('beaver'), kart, pace: { laps: 0, passed }, skill: 1, offset, fx: NO_FX });
  /** A kart on the centre line `d` px along it from `along`, heading the way it runs. */
  const onLine = (along: number, speed = 0): Kart => {
    const p = pointAtPx(track, along);
    return { ...kartAt(p.x, p.y, Math.atan2(p.ty, p.tx)), speed };
  };
  const corner = (index: number) => nth(cornersOf(track).filter((c) => c.index === index), 0);

  it('aims along an arc: a kart on the middle of a left arc is led to the left, on a right arc to the right, and on a straight it is led straight on', () => {
    const left = corner(5), right = corner(2);
    expect(left.turn).toBe('left');
    expect(right.turn).toBe('right');
    const mid = (c: ReturnType<typeof corner>) => (c.start + c.length / 2) * TILE;
    expect(aimOf(track, rivalAt(onLine(mid(left), 80), 5))).toBeLessThan(-0.05);
    expect(aimOf(track, rivalAt(onLine(mid(right), 80), 2))).toBeGreaterThan(0.05);
    expect(Math.abs(aimOf(track, rivalAt(onLine(10 * TILE + track.startAlong, 80), 0)))).toBeLessThan(0.02);
  });

  it('aims at a point of the centre line ahead of it, off it by its offset, not at the next waypoint', () => {
    const k = onLine(track.startAlong + 10 * TILE, 80);
    const straight = aimOf(track, rivalAt(k, 0, 0));
    expect(Math.abs(straight)).toBeLessThan(0.02);
    expect(aimOf(track, rivalAt(k, 0, 14))).toBeGreaterThan(straight);
    expect(aimOf(track, rivalAt(k, 0, -14))).toBeLessThan(straight);
  });

  it('grows its progress along an arc, a step at a time, from the arc\'s start to its end', () => {
    for (const c of cornersOf(track)) {
      let was = -Infinity;
      const passed = track.gates.findIndex((g) => g.index === c.index);
      for (let s = 0; s <= c.length * TILE; s += 2) {
        const p = progressOf(track, { laps: 0, passed }, onLine(c.start * TILE + s));
        expect(p, `arc of waypoint ${c.index}, ${s} in`).toBeGreaterThanOrEqual(was - 1e-6);
        was = p;
      }
    }
  });

  // A radius of 5 tiles or more is taken flat out, on the centre line; a hairpin of 3 is not.
  const through = (c: ReturnType<typeof corner>): { slowest: number; off: number } => {
    const start = Math.max(0, c.start * TILE - 3 * TILE);
    let rival: Rival = { ...rivalAt(onLine(start, RULES.topSpeed), 0), kart: onLine(start, RULES.topSpeed) };
    let slowest = Infinity, off = 0;
    for (let t = 0; t < 4; t += RULES.subStep) {
      rival = driveRival(track, rival, RULES.subStep, progressOf(track, rival.pace, rival.kart));
      const along = locatePx(track, rival.kart.x, rival.kart.y).along;
      if (along >= c.start * TILE && along <= (c.start + c.length) * TILE) {
        slowest = Math.min(slowest, rival.kart.speed);
        off = Math.max(off, locatePx(track, rival.kart.x, rival.kart.y).dist);
      }
    }
    return { slowest, off };
  };

  it('drives every arc of radius 5 or more flat out on the centre line, on the road', () => {
    for (const c of cornersOf(track).filter((x) => x.radius >= 5)) {
      const r = through(c);
      expect(r.slowest, `arc of waypoint ${c.index}`).toBeGreaterThanOrEqual(RULES.topSpeed * 0.95);
      expect(r.off, `arc of waypoint ${c.index}`).toBeLessThan((track.centre.width / 2) * TILE);
    }
  });

  it('does not drive a hairpin of radius 3 flat out: it lifts for it', () => {
    const hairpins = cornersOf(track).filter((x) => x.radius === 3);
    expect(hairpins.length).toBeGreaterThan(0);
    for (const c of hairpins) expect(through(c).slowest, `arc of waypoint ${c.index}`).toBeLessThan(RULES.topSpeed * 0.95);
  });
});

describe('a rival keeps its wheels on the road (PRD 1698)', () => {
  const rivalAt = (kart: Kart, passed: number): Rival => ({ driver: driver('beaver'), kart, pace: { laps: 0, passed }, skill: 1, offset: 0, fx: NO_FX });

  it('steers back from the void when a wheel is over it, with the gas off', () => {
    // Heading north-ish at the top edge of the start straight, a wheel goes over before the rest.
    let k: Kart = { ...kartAt(40 * TILE + 8, 60 * TILE + 10, -Math.PI / 2 + 0.4), speed: 80 };
    while (leanOf(track, k) === 0 && k.y > 60 * TILE - 20) k = { ...k, y: k.y - 0.1 };
    const lean = leanOf(track, k);
    expect(lean).not.toBe(0);
    const after = driveRival(track, rivalAt(k, 0), RULES.subStep, 0);
    expect(after.kart.steer).toBe(lean > 0 ? -1 : 1);
    expect(after.kart.speed).toBeLessThan(80); // the gas is off
  });

  it('looks a quarter of a second ahead: a wheel about to go over the void steers it back too', () => {
    expect(RULES.rivalLook).toBe(0.25);
    let k: Kart = { ...kartAt(40 * TILE + 8, 60 * TILE + 40, -Math.PI / 2 + 0.4), speed: 80 };
    while (leanOf(track, { ...k, x: k.x + Math.cos(k.angle) * 20, y: k.y + Math.sin(k.angle) * 20 }) === 0 && k.y > 60 * TILE - 20) k = { ...k, y: k.y - 0.1 };
    expect(leanOf(track, k)).toBe(0);
    expect(driveRival(track, rivalAt(k, 0), RULES.subStep, 0).kart.steer).not.toBe(0);
  });
});

describe('a kart in the air (PRD 1775)', () => {
  it('is not pushed by a kart on the ground, and does not push it', () => {
    const ground = kartAt(100, 100, 0), air = { ...kartAt(104, 100, 0), height: 5, lift: 10 };
    const [a, b] = pushApart([ground, air]);
    expect(a?.x).toBe(100);
    expect(b?.x).toBe(104);
  });

  it('is pushed by another kart in the air', () => {
    const [a, b] = pushApart([{ ...kartAt(100, 100, 0), height: 5 }, { ...kartAt(104, 100, 0), height: 5 }]);
    expect((b?.x ?? 0) - (a?.x ?? 0)).toBeGreaterThan(4);
  });
});

// The branch at a crossing (PRD 1923, slice 1): a figure eight, its two diagonals crossing at the middle of the map.
describe('on a line that crosses itself', () => {
  const eight = parseTrack(EIGHT);
  const crossing = nth(crossings(eight.centre), 0);
  const startOf = (leg: number) => (eight.centre.segments.find((s) => s.kind === 'straight' && s.leg === leg)?.start ?? NaN) * TILE;
  // The two branches: the distance along the line, in pixels, at which each passes the crossing, and the pace of a kart on it (the gates it has passed).
  const branches = [
    { name: 'the first diagonal', at: startOf(crossing.a.leg) + crossing.a.at * TILE, passed: 2 },
    { name: 'the second diagonal', at: startOf(crossing.b.leg) + crossing.b.at * TILE, passed: 6 },
  ] as const;
  /** A kart on the line `along` pixels in, carrying the distance along it it had a step before when `hint` says so. */
  const onLine = (along: number, before?: Kart): Kart => {
    const p = pointAtPx(eight, along);
    const kart = kartAt(p.x, p.y, Math.atan2(p.ty, p.tx));
    return carryAlong(eight, before ?? { along }, kart);
  };

  it('is told apart from a line that does not cross itself', () => {
    expect(crosses(eight)).toBe(true);
    expect(crosses(track)).toBe(false);
    expect(carryAlong(track, {}, kartAt(10, 10, 0)).along).toBeUndefined();
  });

  it.each(branches)('gives a kart on $name a progress that never goes back while it crosses', ({ at, passed }) => {
    const pace = { laps: 0, passed };
    let before: Kart | undefined;
    let last = -Infinity;
    for (let d = at - 8 * TILE; d <= at + 8 * TILE; d += TILE / 8) {
      const kart = onLine(d, before);
      const progress = progressOf(eight, pace, kart);
      expect(progress).toBeGreaterThanOrEqual(last);
      const laps = (progress - (d - eight.startAlong)) / eight.length;
      expect(laps).toBeCloseTo(Math.round(laps), 6);
      last = progress;
      before = kart;
    }
  });

  it('would put the kart of the second diagonal on the first one at the crossing with nothing carried: that is what the branch is for', () => {
    const second = branches[1];
    const bare = kartAt(pointAtPx(eight, second.at).x, pointAtPx(eight, second.at).y, 0);
    expect(Math.abs(progressOf(eight, { laps: 0, passed: second.passed }, bare) - (second.at - eight.startAlong))).toBeGreaterThan(5 * TILE);
  });

  it.each(branches)('has a rival on $name aim down its own branch, not the other', ({ at }) => {
    const rival: Rival = { ...nth(newRace({ seed: 7, track: eight, cast }).rivals, 0), kart: { ...onLine(at), speed: 60 }, offset: 0 };
    expect(Math.abs(aimOf(eight, rival))).toBeLessThan(0.05);
  });

  it.each(branches)('brings a kart that fell on $name back on it, facing the way it runs there', ({ at, passed }) => {
    const fell = onLine(at);
    const back = comeBack(eight, { laps: 0, passed }, fell, NO_FX).kart;
    const there = pointAtPx(eight, at);
    expect(Math.abs(Math.atan2(Math.sin(back.angle - Math.atan2(there.ty, there.tx)), Math.cos(back.angle - Math.atan2(there.ty, there.tx))))).toBeLessThan(0.1);
    expect(Math.abs((back.along ?? NaN) - at)).toBeLessThan(2 * TILE);
  });

  it('counts a lap once each time the line is crossed, the crossing of the two branches twice a lap included', () => {
    const lap = eight.length;
    let pace = START_PACE;
    let before: Kart | undefined;
    const laps: number[] = [];
    for (let d = eight.startAlong - 3 * TILE; d <= eight.startAlong + 2.5 * lap; d += TILE / 4) {
      const kart = onLine(d, before);
      pace = advance(eight, pace, before ?? kart, kart);
      laps.push(pace.laps);
      before = kart;
    }
    expect(laps.every((n, i) => n === (laps[i - 1] ?? n) || n === (laps[i - 1] ?? 0) + 1)).toBe(true);
    expect(pace.laps).toBe(2);
  });
});

// The surfaces (PRD 1923, slice 3): the rivals drive the same model, so they slide on ice.
describe('on ice and powder', () => {
  const frozen = withFloor(parseTrack(EIGHT));

  it('slides a rival on the lake: its direction of travel is carried there, and is its nose elsewhere', () => {
    let r: Race = play(press(newRace({ seed: 7, track: frozen }), 'start').race, NONE, RULES.countdown + 0.05);
    let slid = false, offLake = true;
    for (let t = 0; t < 60; t += 0.05) {
      r = step(r, NONE, 0.05).race;
      for (const rival of r.rivals) {
        const far = Math.hypot(rival.kart.x - 36 * TILE, rival.kart.y - 36 * TILE);
        if (rival.kart.travel !== undefined) slid = true;
        if (far > 7 * TILE && rival.kart.travel !== undefined) offLake = false;
      }
    }
    expect(slid).toBe(true);
    expect(offLake).toBe(true);
  });
});
