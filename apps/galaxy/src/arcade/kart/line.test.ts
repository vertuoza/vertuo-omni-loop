import { describe, expect, it } from 'vitest';
import { buildLine, gatesOf, inSpan, isRoad, lengthOf, locate, pointAt, racingLine, roadInSpan } from './line';
import type { LineSpec } from './line';

// The centre line's geometry (PRD 1829, slice 1): a pure module, in tiles, nothing in the race reads it yet.

const a = 20;
const r = 4;
const W = 5;
// A square of side `a`, every corner an arc of radius `r`, driven clockwise on a y-down map.
// Distance along the line is 0 where the first corner's arc ends: the first straight runs from x = r to x = a - r.
const square = (extra: Partial<LineSpec> = {}) =>
  buildLine({
    points: [
      { x: 0, y: 0, radius: r },
      { x: a, y: 0, radius: r },
      { x: a, y: a, radius: r },
      { x: 0, y: a, radius: r },
    ],
    width: W,
    ...extra,
  });
const s = Math.SQRT1_2;
const nth = <T>(xs: readonly T[], i: number): T => xs[i] as T;

describe('the length of the line', () => {
  it('is 4(a - 2r) + 2 pi r for a square with round corners', () => {
    expect(lengthOf(square())).toBeCloseTo(4 * (a - 2 * r) + 2 * Math.PI * r, 9);
  });

  it('is the perimeter when the corners are sharp', () => {
    const line = buildLine({
      points: [
        { x: 0, y: 0, radius: 0 },
        { x: 10, y: 0, radius: 0 },
        { x: 10, y: 6, radius: 0 },
        { x: 0, y: 6, radius: 0 },
      ],
      width: 3,
    });
    expect(lengthOf(line)).toBeCloseTo(32, 9);
  });

  it('refuses a corner whose arc does not fit its legs', () => {
    const big = { radius: 6 };
    expect(() =>
      buildLine({
        points: [
          { x: 0, y: 0, ...big },
          { x: 10, y: 0, ...big },
          { x: 10, y: 10, ...big },
          { x: 0, y: 10, ...big },
        ],
        width: 3,
      }),
    ).toThrow();
  });
});

describe('where a point is, along the line and across it', () => {
  it('reads the distance along, across and the tangent on a straight', () => {
    const at = locate(square(), 10, 1.5);
    expect(at.along).toBeCloseTo(10 - r, 9);
    expect(at.across).toBeCloseTo(1.5, 9);
    expect(at.dist).toBeCloseTo(1.5, 9);
    expect(at.tx).toBeCloseTo(1, 9);
    expect(at.ty).toBeCloseTo(0, 9);
  });

  it('reads the same on an arc: along the arc, across from its circle, the tangent turned', () => {
    const c = { x: a - r, y: r }; // the centre of the first arc
    const at = locate(square(), c.x + (r + 1) * s, c.y - (r + 1) * s); // on the diagonal, 1 outside the arc
    expect(at.dist).toBeCloseTo(1, 9);
    expect(at.across).toBeCloseTo(-1, 9);
    expect(at.along).toBeCloseTo(a - 2 * r + (Math.PI * r) / 4, 9);
    expect(at.tx).toBeCloseTo(s, 9);
    expect(at.ty).toBeCloseTo(s, 9);
  });

  it('gives the point on the line at a distance along, and wraps around the closed line', () => {
    const line = square();
    const p = pointAt(line, a - 2 * r + (Math.PI * r) / 4);
    expect(p.x).toBeCloseTo(a - r + r * s, 9);
    expect(p.y).toBeCloseTo(r - r * s, 9);
    const wrapped = pointAt(line, lengthOf(line) + 2);
    const direct = pointAt(line, 2);
    expect(wrapped.x).toBeCloseTo(direct.x, 9);
    expect(wrapped.y).toBeCloseTo(direct.y, 9);
  });
});

describe('whether a pixel is road', () => {
  it('on a straight, is road within half the width of the line and void beyond', () => {
    const line = square();
    expect(isRoad(line, 10, 2.4)).toBe(true);
    expect(isRoad(line, 10, -2.4)).toBe(true);
    expect(isRoad(line, 10, 2.6)).toBe(false);
    expect(isRoad(line, 10, -2.6)).toBe(false);
  });

  it('across an arc, is road between the inner and the outer quarter circles', () => {
    const line = square();
    const c = { x: a - r, y: r };
    const at = (d: number) => isRoad(line, c.x + d * s, c.y - d * s);
    expect(at(r + 2.4)).toBe(true); // just inside the outer edge
    expect(at(r + 2.6)).toBe(false); // beyond it: a square block would still be road here
    expect(at(r - 2.4)).toBe(true); // just outside the inner edge
    expect(at(r - 2.6)).toBe(false); // inside the inner edge
  });

  it('is void in a gap of the line, across the whole road, and road again beyond it', () => {
    const line = square({ gaps: [{ from: 2, length: 3 }] }); // along 2 to 5 on the first straight
    const x = (along: number) => along + r;
    expect(isRoad(line, x(1), 0)).toBe(true);
    expect(isRoad(line, x(3), 0)).toBe(false);
    expect(isRoad(line, x(3), 2)).toBe(false);
    expect(isRoad(line, x(6), 0)).toBe(true);
  });

  it('adds a piece, a straight of its own width, and leaves its own gap void', () => {
    // From (10, 2) up to (10, -12): 14 long, 1 wide, a gap from 6 to 8 along it (y from -4 to -6).
    const line = square({ pieces: [{ from: { x: 10, y: 2 }, to: { x: 10, y: -12 }, width: 1, gaps: [{ from: 6, length: 2 }] }] });
    expect(isRoad(line, 10, -3)).toBe(true); // on the piece, off the line's road
    expect(isRoad(line, 10.4, -3)).toBe(true);
    expect(isRoad(line, 10.6, -3)).toBe(false); // beyond the piece's half width
    expect(isRoad(line, 10, -5)).toBe(false); // in the piece's gap
    expect(isRoad(line, 10, -7)).toBe(true); // past it
    expect(isRoad(line, 10, -12.5)).toBe(false); // past the piece's end
  });
});

describe('the racing line', () => {
  it('lies on the centre line, half a tile apart, arcs included', () => {
    const line = square();
    const samples = racingLine(line);
    expect(samples.length).toBe(Math.floor(lengthOf(line) / 0.5) + 1);
    for (const p of samples) expect(locate(line, p.x, p.y).dist).toBeLessThan(1e-9);
    for (let i = 1; i < samples.length; i++) {
      expect(Math.hypot(nth(samples, i).x - nth(samples, i - 1).x, nth(samples, i).y - nth(samples, i - 1).y)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
    const first = nth(samples, 0);
    const last = nth(samples, samples.length - 1);
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it('keeps the distance along on each sample, and the tangent', () => {
    const samples = racingLine(square());
    expect(nth(samples, 3).along).toBeCloseTo(1.5, 9);
    expect(nth(samples, 3).tx).toBeCloseTo(1, 9);
  });
});

describe('the gates', () => {
  it('stands at the middle of each arc, normal to the line, as wide as the road', () => {
    const gates = gatesOf(square());
    expect(gates).toHaveLength(4);
    const g = nth(gates, 1); // the corner at (a, 0): the first arc met when driving from along 0
    expect(g.index).toBe(1);
    expect(g.x).toBeCloseTo(a - r + r * s, 9);
    expect(g.y).toBeCloseTo(r - r * s, 9);
    expect(Math.hypot(g.bx - g.ax, g.by - g.ay)).toBeCloseTo(W, 9);
    expect((g.bx - g.ax) * g.tx + (g.by - g.ay) * g.ty).toBeCloseTo(0, 9);
    expect((g.ax + g.bx) / 2).toBeCloseTo(g.x, 9);
    expect((g.ay + g.by) / 2).toBeCloseTo(g.y, 9);
    expect(g.along).toBeCloseTo(a - 2 * r + (Math.PI * r) / 4, 9);
  });

  it('has no gate for a sharp corner, which has no arc', () => {
    const line = buildLine({
      points: [
        { x: 0, y: 0, radius: 0 },
        { x: 10, y: 0, radius: 3 },
        { x: 10, y: 10, radius: 0 },
        { x: 0, y: 10, radius: 3 },
      ],
      width: 3,
    });
    expect(gatesOf(line).map((g) => g.index)).toEqual([1, 3]);
  });
});

describe('a span', () => {
  const span = { start: 10, length: 6 };

  it('covers the road within it and nothing beyond', () => {
    const line = square();
    const inside = pointAt(line, 12);
    const before = pointAt(line, 9);
    const after = pointAt(line, 17);
    expect(roadInSpan(line, span, inside.x, inside.y)).toBe(true);
    expect(roadInSpan(line, span, before.x, before.y)).toBe(false);
    expect(roadInSpan(line, span, after.x, after.y)).toBe(false);
    expect(roadInSpan(line, span, inside.x, inside.y + 3)).toBe(false); // void is not road
  });

  it('wraps past the end of the closed line', () => {
    const line = square();
    const L = lengthOf(line);
    const wrap = { start: L - 2, length: 5 };
    expect(inSpan(line, wrap, L - 1)).toBe(true);
    expect(inSpan(line, wrap, 1)).toBe(true);
    expect(inSpan(line, wrap, 4)).toBe(false);
  });
});
