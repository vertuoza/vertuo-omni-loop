import { describe, expect, it } from 'vitest';
import { steerOf } from './steer';
import { BAND_HZ, LIMITS } from './rules';

describe('steerOf', () => {
  it('holds a ±10 Hz band', () => {
    expect(BAND_HZ).toBe(10);
  });

  for (const limit of [160, 220, 300]) {
    it(`moves up 11 Hz above ${String(limit)} Hz, down 11 Hz below, and holds still inside the band`, () => {
      expect(steerOf(limit + 11, limit)).toBe('up');
      expect(steerOf(limit - 11, limit)).toBe('down');
      expect(steerOf(limit, limit)).toBe('still');
      expect(steerOf(limit + 9, limit)).toBe('still');
      expect(steerOf(limit - 9, limit)).toBe('still');
      expect(steerOf(limit + 10, limit)).toBe('still');
      expect(steerOf(limit - 10, limit)).toBe('still');
    });
  }

  it('holds still in silence', () => {
    for (const limit of Object.values(LIMITS)) expect(steerOf(null, limit)).toBe('still');
  });
});
