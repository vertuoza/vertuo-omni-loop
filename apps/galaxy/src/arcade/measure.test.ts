import { describe, expect, it } from 'vitest';
import { bestOf, betterThan, measureOf, orderOf, textOf } from './measure.ts';

describe('measure', () => {
  it('says a higher score is better for points and a lower time for a time', () => {
    expect(betterThan('points', 9, 5)).toBe(true);
    expect(betterThan('points', 5, 9)).toBe(false);
    expect(betterThan('points', 5, 5)).toBe(false);
    expect(betterThan('time', 5, 9)).toBe(true);
    expect(betterThan('time', 9, 5)).toBe(false);
    expect(betterThan('time', 5, 5)).toBe(false);
  });

  it('keeps the better of two', () => {
    expect(bestOf('points', 3, 8)).toBe(8);
    expect(bestOf('points', 8, 3)).toBe(8);
    expect(bestOf('time', 3, 8)).toBe(3);
    expect(bestOf('time', 8, 3)).toBe(3);
  });

  it('orders a table best first', () => {
    expect([3, 9, 5].sort(orderOf('points'))).toEqual([9, 5, 3]);
    expect([3, 9, 5].sort(orderOf('time'))).toEqual([3, 5, 9]);
  });

  it('writes a best in its measure', () => {
    expect(textOf('points', 9210)).toBe('9 210');
    expect(textOf('points', 42)).toBe('42');
    expect(textOf('time', 1023)).toBe('1:42.3');
  });

  it('reads a game\'s measure from its id, points for an unknown one', () => {
    expect(measureOf('kart')).toBe('time');
    expect(measureOf('invaders')).toBe('points');
    expect(measureOf('platformer')).toBe('points');
    expect(measureOf('maze')).toBe('points');
  });
});
