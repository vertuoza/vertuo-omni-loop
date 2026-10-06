import { describe, expect, it } from 'vitest';
import { assertDefined } from './assert.ts';

describe('assertDefined — a test’s `!`, proven instead of claimed', () => {
  it('passes a present value and narrows it, falsy ones included', () => {
    const found: { name: string } | undefined = [{ name: 'kit' }].find((entry) => entry.name === 'kit');
    assertDefined(found, 'the first package');
    expect(found.name).toBe('kit');
    expect(() => {
      assertDefined(0, 'the count');
    }).not.toThrow();
  });

  it('fails the test on undefined and null, naming what was missing', () => {
    expect(() => {
      assertDefined(undefined, 'the claimed slice');
    }).toThrow('expected the claimed slice, got undefined');
    expect(() => {
      assertDefined(null, 'the status comment');
    }).toThrow('expected the status comment, got null');
  });
});
