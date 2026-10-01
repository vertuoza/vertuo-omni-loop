import { describe, expect, it } from 'vitest';
import { formFor } from './form';

describe('formFor', () => {
  it('gives the screen alone to a mouse, at every size', () => {
    for (const [width, height] of [[1440, 900], [393, 852], [852, 393], [800, 800], [320, 480]] as [number, number][]) {
      expect(formFor({ finePointer: true, width, height }), `${width}×${height}`).toBe('full');
    }
  });

  it('gives the Game Boy to touch held upright', () => {
    expect(formFor({ finePointer: false, width: 393, height: 852 })).toBe('handheld');
    expect(formFor({ finePointer: false, width: 820, height: 1180 })).toBe('handheld');
  });

  it('gives the Advance body to touch held sideways', () => {
    expect(formFor({ finePointer: false, width: 852, height: 393 })).toBe('advance');
    expect(formFor({ finePointer: false, width: 1180, height: 820 })).toBe('advance');
  });

  it('gives the Game Boy to a square touch viewport', () => {
    expect(formFor({ finePointer: false, width: 600, height: 600 })).toBe('handheld');
  });
});
