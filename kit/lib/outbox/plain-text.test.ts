import { describe, expect, it } from 'vitest';
import { isList, plainText } from './plain-text.ts';

describe('plainText', () => {
  it('reads text as it is, and a number or a boolean written out', () => {
    expect(plainText('  a reply ')).toBe('  a reply ');
    expect(plainText(42)).toBe('42');
    expect(plainText(false)).toBe('false');
  });

  it('reads nothing, an object or a list as no text at all', () => {
    expect(plainText(undefined)).toBe('');
    expect(plainText(null)).toBe('');
    expect(plainText({ body: 'x' })).toBe('');
    expect(plainText(['x'])).toBe('');
  });
});

describe('isList', () => {
  it('accepts a list, empty or not', () => {
    expect(isList(['a'])).toBe(true);
    expect(isList([])).toBe(true);
  });

  it('refuses nothing', () => {
    expect(isList(null)).toBe(false);
    expect(isList(undefined)).toBe(false);
  });
});
