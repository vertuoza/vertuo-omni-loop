import { describe, expect, it } from 'vitest';
import { isRecord } from './is-record';

describe('isRecord', () => {
  it('accepts any non-null object, an array included', () => {
    expect(isRecord({ mode: 'on' })).toBe(true);
    expect(isRecord([])).toBe(true);
  });

  it('refuses null and every value that is not an object', () => {
    for (const value of [null, undefined, 'on', 3, true]) expect(isRecord(value)).toBe(false);
  });
});
