// The engine's motion primitives (PRD 1108 s4): easings, springs and `interpolate`, each a pure function
// of its input, so a frame renders the same pixels every time.
import { describe, expect, it } from 'vitest';
import { EASINGS, SPRINGS, bezier, clamp, interpolate, mix, spring } from './animation.ts';

describe('bezier', () => {
  it('starts at 0, ends at 1 and clamps outside them', () => {
    const ease = bezier(0.16, 1, 0.3, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-0.5)).toBe(0);
    expect(ease(1.5)).toBe(1);
  });

  it('is the identity for the linear control points', () => {
    const linear = bezier(0, 0, 1, 1);
    for (const x of [0.1, 0.25, 0.5, 0.9]) expect(linear(x)).toBeCloseTo(x, 5);
  });

  it('solves a CSS curve where the browser does', () => {
    // CSS `ease` (0.25, 0.1, 0.25, 1) at x = 0.5 is about 0.8024.
    expect(bezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 3);
  });

  it('gives a symmetric in-out curve its middle at its middle, and an out curve its rise early', () => {
    expect(EASINGS.inOut(0.5)).toBeCloseTo(0.5, 5);
    expect(EASINGS.out(0.2)).toBeGreaterThan(0.5);
    expect(EASINGS.in(0.2)).toBeLessThan(0.1);
    expect(EASINGS.linear(0.3)).toBe(0.3);
  });
});

describe('interpolate', () => {
  it('maps a value across one range onto another', () => {
    expect(interpolate(5, [0, 10], [100, 200])).toBe(150);
    expect(interpolate(0, [0, 10], [100, 200])).toBe(100);
  });

  it('clamps on both sides by default, and extends when asked', () => {
    expect(interpolate(-5, [0, 10], [0, 1])).toBe(0);
    expect(interpolate(15, [0, 10], [0, 1])).toBe(1);
    expect(interpolate(15, [0, 10], [0, 1], { extend: true })).toBe(1.5);
    expect(interpolate(-5, [0, 10], [0, 1], { extend: true })).toBe(-0.5);
  });

  it('walks a range of many stops, segment by segment', () => {
    expect(interpolate(15, [0, 10, 20], [0, 1, 0])).toBe(0.5);
    expect(interpolate(10, [0, 10, 20], [0, 1, 0])).toBe(1);
    expect(interpolate(2.5, [0, 5, 10, 20], [0, 10, 0, 40])).toBe(5);
  });

  it('eases inside a segment', () => {
    expect(interpolate(5, [0, 10], [0, 1], { easing: EASINGS.in })).toBeCloseTo(EASINGS.in(0.5), 10);
  });

  it('holds the end of a segment of no length', () => {
    expect(interpolate(3, [3, 3], [0, 1])).toBe(1);
  });

  it('refuses ranges that do not match', () => {
    expect(() => interpolate(1, [0, 1], [0, 1, 2])).toThrow(/ranges/);
    expect(() => interpolate(1, [0], [0])).toThrow(/ranges/);
  });
});

describe('spring', () => {
  it('is 0 before it starts and settles on 1', () => {
    expect(spring(-3, 30)).toBe(0);
    expect(spring(0, 30)).toBe(0);
    expect(spring(120, 30)).toBeCloseTo(1, 3);
  });

  it('rises monotonically without overshoot for the smooth spring', () => {
    let last = 0;
    for (let frame = 1; frame <= 90; frame += 1) {
      const value = spring(frame, 30, SPRINGS.smooth);
      expect(value).toBeGreaterThanOrEqual(last - 1e-9);
      expect(value).toBeLessThanOrEqual(1.0005);
      last = value;
    }
  });

  it('overshoots for the bouncy spring', () => {
    const peak = Math.max(...Array.from({ length: 60 }, (_, frame) => spring(frame, 30, SPRINGS.bouncy)));
    expect(peak).toBeGreaterThan(1.02);
  });

  it('gives the same value whatever order the frames are asked in, and between frames', () => {
    const late = spring(40, 30, SPRINGS.snappy);
    const early = spring(10, 30, SPRINGS.snappy);
    expect(spring(40, 30, SPRINGS.snappy)).toBe(late);
    expect(spring(10, 30, SPRINGS.snappy)).toBe(early);
    const half = spring(10.5, 30, SPRINGS.snappy);
    expect(half).toBeCloseTo((spring(10, 30, SPRINGS.snappy) + spring(11, 30, SPRINGS.snappy)) / 2, 10);
  });

  it('settles faster at a stiffer spring', () => {
    expect(spring(8, 30, SPRINGS.snappy)).toBeGreaterThan(spring(8, 30, SPRINGS.smooth));
    expect(spring(8, 30, SPRINGS.heavy)).toBeLessThan(spring(8, 30, SPRINGS.smooth));
  });
});

describe('clamp and mix', () => {
  it('clamps to 0..1 by default and to a range when given', () => {
    expect(clamp(2)).toBe(1);
    expect(clamp(-1)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('mixes two numbers', () => {
    expect(mix(10, 20, 0.25)).toBe(12.5);
  });
});
