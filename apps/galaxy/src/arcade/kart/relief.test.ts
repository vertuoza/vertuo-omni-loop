import { describe, expect, it } from 'vitest';
import { groundAt, heightsOf, reliefRange, slopeAt } from './relief';
import { COMET_RING, cornersOf, LEVEL, parseTrack, pointAtPx, TILE, type Relief, type TrackSource } from './track';
import { paintTrack } from './texture';

// The ground under COMET RING (PRD 1698, PRD 1829): the height of the centre line at the point nearest to a point, level over each arc.

const hills = parseTrack();
/** The same circuit without its shortcuts, whose own legs the ground eases along where they are nearer than the line. */
const plain = parseTrack({ ...COMET_RING, shortcuts: [] });
const centre = (x: number, y: number) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
const hilly = (relief: Relief) => parseTrack({ ...COMET_RING, relief });
const N = COMET_RING.waypoints.length;
const zeros = Array.from({ length: N }, () => 0);
const heights = COMET_RING.relief?.heights ?? [];
/** The middle of the arc of a corner, and a point of it `across` px from the centre line (positive to the left of the way it runs). */
const arcPoint = (start: number, length: number, k: number, across = 0) => {
  const p = pointAtPx(hills, (start + length * k) * TILE);
  return { x: p.x + p.ty * across, y: p.y - p.tx * across };
};

describe('the ground of a circuit with no relief', () => {
  it('is flat everywhere, and its slope zero', () => {
    const bare = parseTrack(Object.fromEntries(Object.entries(COMET_RING).filter(([k]) => k !== 'relief')) as unknown as TrackSource);
    expect(bare.relief).toEqual({ heights: zeros, bumps: zeros });
    for (const [x, y] of [[100, 900], [500, 300], [30, 30]] as const) {
      expect(groundAt(bare, x, y)).toBe(0);
      expect(slopeAt(bare, x, y, 1.2)).toBe(0);
    }
    expect(reliefRange(bare)).toEqual({ low: 0, high: 0 });
  });
});

describe('the ground of COMET RING', () => {
  it('is level across each arc: a corner\'s height at every point of its arc, and at both sides of the road', () => {
    for (const c of cornersOf(hills)) {
      for (const k of [0, 0.25, 0.5, 0.75, 1]) {
        for (const across of [-2 * TILE, 0, 2 * TILE]) {
          const p = arcPoint(c.start, c.length, k, across);
          expect(groundAt(plain, p.x, p.y), `arc of waypoint ${c.index}, ${k} along, ${across} across`).toBeCloseTo(heights[c.index] ?? NaN, 6);
        }
      }
    }
  });

  it('is the same height at the two ends of a leg as at the arcs it joins', () => {
    expect(LEVEL).toBe(2.5 * TILE);
    // Leg 4 runs north from the arc of waypoint 4, at 20, to the arc of waypoint 5, at 4.
    const a = centre(64, 31), b = centre(64, 15);
    expect(groundAt(hills, a.x, a.y + TILE / 2)).toBeCloseTo(20, 6);
    expect(groundAt(hills, b.x, b.y - TILE / 2)).toBeCloseTo(4, 6);
  });

  it('is the same on both sides of the road', () => {
    const p = centre(53, 10);
    expect(groundAt(hills, p.x, p.y - 30)).toBeCloseTo(groundAt(hills, p.x, p.y + 30), 6);
  });

  it('is the leg\'s bump at its middle: a hump rises over the two heights, a dip sinks under them', () => {
    // Leg 5 runs west from the arc of waypoint 5 to that of waypoint 6 between two heights of 4, with a hump of 12.
    const hump = { x: 53.5 * TILE, y: 10.5 * TILE };
    expect(groundAt(hills, hump.x, hump.y)).toBeCloseTo(4 + 12, 6);
    // Leg 3 runs east from the arc of waypoint 3 to that of waypoint 4 between two heights of 20, with a dip of 5.
    const dip = { x: 57 * TILE, y: 34.5 * TILE };
    expect(groundAt(hills, dip.x, dip.y)).toBeCloseTo(20 - 5, 6);
  });

  it('keeps the start straight flat', () => {
    const p = centre(40, 62);
    expect(groundAt(hills, p.x, p.y)).toBe(0);
  });

  it('has a range from its lowest road to its highest, spanning 26 at most', () => {
    const { low, high } = reliefRange(hills);
    expect(low).toBeCloseTo(-4, 1); // the dip of leg 7
    expect(high).toBeGreaterThanOrEqual(20);
    expect(high - low).toBeLessThanOrEqual(26);
  });

  it('never moves more than 1 unit of ground in 1 unit of distance along the centre line', () => {
    let last = groundAt(hills, hills.line.x, hills.line.y);
    for (let d = 1; d <= hills.length; d++) {
      const p = pointAtPx(hills, hills.startAlong + d);
      const h = groundAt(hills, p.x, p.y);
      expect(Math.abs(h - last), `at ${d}`).toBeLessThanOrEqual(1);
      last = h;
    }
  });
});

describe('the slope', () => {
  // Leg 5 again: the hump on the way west. Going west up to its middle the ground rises, then falls.
  const before = centre(56, 10), after = centre(50, 10);

  it('is positive climbing and negative going down', () => {
    expect(slopeAt(hills, before.x, before.y, Math.PI)).toBeGreaterThan(0);
    expect(slopeAt(hills, after.x, after.y, Math.PI)).toBeLessThan(0);
  });

  it('changes sign with the heading', () => {
    expect(slopeAt(hills, before.x, before.y, 0)).toBeCloseTo(-slopeAt(hills, before.x, before.y, Math.PI), 9);
  });

  it('is zero on the level and across the hill', () => {
    const top = { x: 53.5 * TILE, y: 10.5 * TILE };
    expect(slopeAt(hills, top.x, top.y, Math.PI)).toBeCloseTo(0, 9);
    expect(slopeAt(hills, before.x, before.y, Math.PI / 2)).toBeCloseTo(0, 9);
  });

  it('is zero over an arc, whichever way a kart faces', () => {
    for (const c of cornersOf(hills)) {
      const p = arcPoint(c.start, c.length, 0.5);
      for (const angle of [0, 1, 2, 3, 4, 5]) expect(slopeAt(hills, p.x, p.y, angle), `arc of waypoint ${c.index}`).toBeCloseTo(0, 6);
    }
  });
});

describe('the height under every pixel of the texture', () => {
  it('holds the ground under the road, and 0 under the void', () => {
    const track = hilly({ heights: zeros.map((_, i) => (i === 0 ? 8 : 0)), bumps: zeros });
    const texture = paintTrack(track);
    const out = heightsOf(track, texture);
    expect(out).toHaveLength(texture.w * texture.h);
    const c = cornersOf(track).find((x) => x.index === 0);
    const p = pointAtPx(track, ((c?.start ?? 0) + (c?.length ?? 0) / 2) * TILE);
    expect(out[Math.floor(p.y) * texture.w + Math.floor(p.x)]).toBeCloseTo(8, 6);
    expect(out[0]).toBe(0); // the map's corner is void
  });
});

describe('the ground of a shortcut (PRD 1775)', () => {
  it.each(hills.shortcuts.map((s, i) => [i, s] as const))('eases shortcut %i from the ground where it leaves the line to the ground where it rejoins it', (_, sc) => {
    expect(groundAt(hills, sc.from.x, sc.from.y)).toBeCloseTo(groundAt(plain, sc.from.x, sc.from.y), 6);
    expect(groundAt(hills, sc.to.x, sc.to.y)).toBeCloseTo(groundAt(plain, sc.to.x, sc.to.y), 6);
  });

  it.each(hills.shortcuts.map((s, i) => [i, s] as const))('never moves more than 1 unit of ground in 1 unit of distance along shortcut %i, and stays between its two heights', (_, sc) => {
    const length = Math.hypot(sc.to.x - sc.from.x, sc.to.y - sc.from.y);
    const dir = { x: (sc.to.x - sc.from.x) / length, y: (sc.to.y - sc.from.y) / length };
    const lo = groundAt(hills, sc.from.x, sc.from.y), hi = groundAt(hills, sc.to.x, sc.to.y);
    let last = lo;
    for (let d = 1; d <= length; d++) {
      const h = groundAt(hills, sc.from.x + dir.x * d, sc.from.y + dir.y * d);
      expect(Math.abs(h - last), `at ${d}`).toBeLessThanOrEqual(1);
      expect(h).toBeGreaterThanOrEqual(Math.min(lo, hi) - 1e-6);
      expect(h).toBeLessThanOrEqual(Math.max(lo, hi) + 1e-6);
      last = h;
    }
  });

  it('leaves the ground of every point of the racing line as it is without the shortcuts', () => {
    for (let d = 0; d < hills.length; d += 4) {
      const p = pointAtPx(hills, hills.startAlong + d);
      expect(groundAt(hills, p.x, p.y), `${d} along`).toBeCloseTo(groundAt(plain, p.x, p.y), 6);
    }
  });
});
