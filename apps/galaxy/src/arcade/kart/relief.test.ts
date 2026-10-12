import { describe, expect, it } from 'vitest';
import { groundAt, heightsOf, reliefRange, slopeAt } from './relief';
import { COMET_RING, LEVEL, parseTrack, TILE, type Relief } from './track';
import { paintTrack } from './texture';

// The ground under COMET RING (PRD 1698): the height of the leg of the racing line nearest to a point.

const hills = parseTrack();
const centre = (x: number, y: number) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
const hilly = (relief: Relief) => parseTrack({ ...COMET_RING, relief });
const N = COMET_RING.waypoints.length;
const zeros = Array.from({ length: N }, () => 0);

describe('the ground of a circuit with no relief', () => {
  it('is flat everywhere, and its slope zero', () => {
    const plain = parseTrack({ rows: COMET_RING.rows, waypoints: COMET_RING.waypoints });
    expect(plain.relief).toEqual({ heights: zeros, bumps: zeros });
    for (const [x, y] of [[100, 900], [500, 300], [30, 30]] as const) {
      expect(groundAt(plain, x, y)).toBe(0);
      expect(slopeAt(plain, x, y, 1.2)).toBe(0);
    }
    expect(reliefRange(plain)).toEqual({ low: 0, high: 0 });
  });
});

describe('the ground of COMET RING', () => {
  const w = COMET_RING.waypoints;
  const heights = COMET_RING.relief?.heights ?? [];

  it('is a waypoint\'s height at that waypoint', () => {
    w.forEach(([x, y], i) => {
      const p = centre(x, y);
      expect(groundAt(hills, p.x, p.y), `waypoint ${i}`).toBeCloseTo(heights[i] ?? NaN, 6);
    });
  });

  it('is level for 2.5 tiles at both ends of a leg', () => {
    expect(LEVEL).toBe(2.5 * TILE);
    // Leg 4 runs north from [56, 28], at 20, to [56, 8], at 4.
    const a = centre(56, 28), b = centre(56, 8);
    for (const d of [0, 10, LEVEL - 0.5]) {
      expect(groundAt(hills, a.x, a.y - d)).toBeCloseTo(20, 6);
      expect(groundAt(hills, b.x, b.y + d)).toBeCloseTo(4, 6);
    }
  });

  it('is the same on both sides of the road', () => {
    const p = centre(46, 8);
    expect(groundAt(hills, p.x, p.y - 30)).toBeCloseTo(groundAt(hills, p.x, p.y + 30), 6);
  });

  it('is the leg\'s bump at its middle: a hump rises over the two heights, a dip sinks under them', () => {
    // Leg 5 runs west from [56, 8] to [36, 8] between two heights of 4, with a hump of 12.
    const hump = centre(46, 8);
    expect(groundAt(hills, hump.x, hump.y)).toBeCloseTo(4 + 12, 6);
    // Leg 3 runs east from [44, 28] to [56, 28] between two heights of 20, with a dip of 5.
    const dip = centre(50, 28);
    expect(groundAt(hills, dip.x, dip.y)).toBeCloseTo(20 - 5, 6);
  });

  it('keeps the start straight flat', () => {
    const p = centre(36, 56);
    expect(groundAt(hills, p.x, p.y)).toBe(0);
  });

  it('has a range from its lowest road to its highest, spanning 26 at most', () => {
    const { low, high } = reliefRange(hills);
    expect(low).toBeCloseTo(-4, 6); // the dip of leg 7
    expect(high).toBeGreaterThanOrEqual(20);
    expect(high - low).toBeLessThanOrEqual(26);
  });
});

describe('the slope', () => {
  // Leg 5 again: the hump on the way west. Going west up to its middle the ground rises, then falls.
  const before = centre(50, 8), after = centre(42, 8);

  it('is positive climbing and negative going down', () => {
    expect(slopeAt(hills, before.x, before.y, Math.PI)).toBeGreaterThan(0);
    expect(slopeAt(hills, after.x, after.y, Math.PI)).toBeLessThan(0);
  });

  it('changes sign with the heading', () => {
    expect(slopeAt(hills, before.x, before.y, 0)).toBeCloseTo(-slopeAt(hills, before.x, before.y, Math.PI), 9);
  });

  it('is zero on the level and across the hill', () => {
    const level = centre(54, 8);
    expect(slopeAt(hills, level.x, level.y, Math.PI)).toBeCloseTo(0, 9);
    expect(slopeAt(hills, before.x, before.y, Math.PI / 2)).toBeCloseTo(0, 9);
  });
});

describe('the height under every pixel of the texture', () => {
  it('holds the ground under the road, and 0 under the void', () => {
    const track = hilly({ heights: zeros.map((_, i) => (i === 0 ? 8 : 0)), bumps: zeros });
    const texture = paintTrack(track);
    const heights = heightsOf(track, texture);
    expect(heights).toHaveLength(texture.w * texture.h);
    const p = centre(54, 56);
    expect(heights[Math.floor(p.y) * texture.w + Math.floor(p.x)]).toBeCloseTo(8, 6);
    expect(heights[0]).toBe(0); // the map's corner is void
  });
});
