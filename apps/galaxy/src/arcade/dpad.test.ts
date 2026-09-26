import { describe, expect, it } from 'vitest';
import { DEAD_ZONE, dpadDirection } from './dpad';

// The offset of the finger from the cross's centre, in CSS px, y pointing down.
describe('the D-pad rocker', () => {
  it('reads each arm', () => {
    expect(dpadDirection(0, -40)).toBe('up');
    expect(dpadDirection(0, 40)).toBe('down');
    expect(dpadDirection(-40, 0)).toBe('left');
    expect(dpadDirection(40, 0)).toBe('right');
  });

  it('has a dead zone under 10px from the centre, in straight-line distance', () => {
    expect(DEAD_ZONE).toBe(10);
    expect(dpadDirection(0, 0)).toBeNull();
    expect(dpadDirection(9, 0)).toBeNull();
    expect(dpadDirection(10, 0)).toBe('right');
    expect(dpadDirection(7, 7)).toBeNull(); // 9.9px away
    expect(dpadDirection(-8, 6)).toBe('left'); // 10px away
  });

  it('lets the axis with the larger offset win, and gives a tie to the vertical axis', () => {
    expect(dpadDirection(20, 20)).toBe('down');
    expect(dpadDirection(-20, -20)).toBe('up');
    expect(dpadDirection(20, 19)).toBe('right');
    expect(dpadDirection(-19, 20)).toBe('down');
  });
});
