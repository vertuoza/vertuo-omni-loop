import { describe, expect, it } from 'vitest';
import { corners, hits, type Block } from './collide';

// OMNI DUET's collisions (PRD 1633, slice 3): an orb's circle against a block's rectangle, at the
// edges and the corners, a turned block tested in its own frame, and a graze that does not overlap.

const block = (over: Partial<Block> = {}): Block => ({ cx: 100, cy: 100, w: 40, h: 12, angle: 0, ...over });
const orb = (x: number, y: number, r = 6) => ({ x, y, r });

describe('a circle against a block', () => {
  it('hits when the circle sits inside the block, or overlaps it from any side', () => {
    expect(hits(orb(100, 100), block())).toBe(true);
    expect(hits(orb(100 - 20 - 5, 100), block())).toBe(true); // into the left edge by 1
    expect(hits(orb(100 + 20 + 5, 100), block())).toBe(true); // the right edge
    expect(hits(orb(100, 100 - 6 - 5), block())).toBe(true); // the top edge
    expect(hits(orb(100, 100 + 6 + 5), block())).toBe(true); // the bottom edge
  });

  it('misses when the circle is clear of every edge', () => {
    expect(hits(orb(100 - 20 - 7, 100), block())).toBe(false);
    expect(hits(orb(100 + 20 + 7, 100), block())).toBe(false);
    expect(hits(orb(100, 100 - 6 - 7), block())).toBe(false);
    expect(hits(orb(100, 100 + 6 + 7), block())).toBe(false);
  });

  it('tells a corner hit from a near miss past the corner', () => {
    // The corner is at (120, 106); a circle of radius 6 whose centre is 5 away on the diagonal overlaps it.
    const d = 5 / Math.SQRT2;
    expect(hits(orb(120 + d, 106 + d), block())).toBe(true);
    // 7 away on the diagonal: inside the bounding box's reach on each axis, but clear of the corner.
    const e = 7 / Math.SQRT2;
    expect(hits(orb(120 + e, 106 + e), block())).toBe(false);
  });

  it('counts a graze as no hit: a circle that only touches an edge or a corner does not overlap it', () => {
    expect(hits(orb(100 + 20 + 6, 100), block())).toBe(false);
    expect(hits(orb(100, 100 - 6 - 6), block())).toBe(false);
    expect(hits(orb(120 + 6 / Math.SQRT2, 106 + 6 / Math.SQRT2), block())).toBe(false);
  });
});

describe('a turned block', () => {
  it('is tested in its own frame: a bar turned a quarter turn stands upright', () => {
    const upright = block({ angle: Math.PI / 2 });
    // 15 below the centre: inside the upright bar's length, far below the flat bar's thickness.
    expect(hits(orb(100, 115), upright)).toBe(true);
    expect(hits(orb(100, 115), block())).toBe(false);
    // 15 right of the centre: inside the flat bar, beside the upright one.
    expect(hits(orb(115, 100), block())).toBe(true);
    expect(hits(orb(115, 100), upright)).toBe(false);
  });

  it('turns anticlockwise on the screen, as the orbs do: at an eighth of a turn its right end rises', () => {
    const turned = block({ angle: Math.PI / 4 });
    const along = (t: number) => orb(100 + t * Math.SQRT1_2, 100 - t * Math.SQRT1_2, 2);
    expect(hits(along(18), turned)).toBe(true); // up and to the right, along the bar
    expect(hits(orb(100 + 18 * Math.SQRT1_2, 100 + 18 * Math.SQRT1_2, 2), turned)).toBe(false); // down and to the right
  });

  it('gives its corners where the drawing puts them, turned about its centre', () => {
    const [a, b, c, d] = corners(block({ angle: Math.PI / 2 }));
    for (const [p, x, y] of [[a, 94, 120], [b, 94, 80], [c, 106, 80], [d, 106, 120]] as const) {
      expect(p.x).toBeCloseTo(x, 9);
      expect(p.y).toBeCloseTo(y, 9);
    }
    expect(corners(block())).toEqual([{ x: 80, y: 94 }, { x: 120, y: 94 }, { x: 120, y: 106 }, { x: 80, y: 106 }]);
  });

  it('hits only where the turned rectangle is, never across its bounding box', () => {
    const turned = block({ angle: Math.PI / 4, w: 40, h: 4 });
    // The bounding box's top left corner is far from a bar on the rising diagonal.
    expect(hits(orb(86, 86, 2), turned)).toBe(false);
    expect(hits(orb(114, 86, 2), turned)).toBe(true);
  });
});
