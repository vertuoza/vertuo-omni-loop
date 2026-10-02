import { describe, expect, it } from 'vitest';
import { at, dateParts, defined, firstPart, group, isOneOf, keysOf, messageOf, positionOf, propertyOf } from './narrow.ts';

const KINDS = ['open', 'drift'] as const;

describe('isOneOf — includes() on a narrower union, proven instead of asserted', () => {
  it('accepts a value of the list', () => {
    expect(isOneOf(KINDS, 'drift')).toBe(true);
  });

  it('refuses a value outside it, of any type', () => {
    expect(isOneOf(KINDS, 'settled')).toBe(false);
    expect(isOneOf(KINDS, 1)).toBe(false);
    expect(isOneOf(KINDS, null)).toBe(false);
  });
});

describe('positionOf — indexOf() with a value of any type', () => {
  it('finds a value of the list', () => {
    expect(positionOf(['a', 'b', 'c'], 'b')).toBe(1);
  });

  it('answers -1 for a value outside it', () => {
    expect(positionOf(['a', 'b'], null)).toBe(-1);
  });
});

describe('group — a regex group that must match', () => {
  it('gives the group the match holds', () => {
    expect(group('v0.0.12'.match(/^v(\d+)\.(\d+)\.(\d+)$/), 3)).toBe('12');
  });

  it('throws when the group did not take part in the match', () => {
    expect(() => group('ab'.match(/a(x)?b/), 1)).toThrow('group 1 did not match');
  });

  it('throws when there is no match at all', () => {
    expect(() => group('ab'.match(/z/), 0)).toThrow('group 0 did not match');
  });
});

describe('firstPart — a split’s first part', () => {
  it('gives the text before the first separator', () => {
    expect(firstPart('first line\nsecond line', '\n')).toBe('first line');
    expect(firstPart('ana@example.com', '@')).toBe('ana');
  });

  it('gives the whole text when the separator is not in it', () => {
    expect(firstPart('one line', '\n')).toBe('one line');
  });
});

describe('dateParts — a YYYY-MM-DD date’s three numbers', () => {
  it('splits a date into its year, month and day', () => {
    expect(dateParts('2026-10-02')).toEqual([2026, 10, 2]);
  });

  it('refuses a text that is not a YYYY-MM-DD date', () => {
    expect(() => dateParts('2026-10-02T09:00:00Z')).toThrow('not a YYYY-MM-DD date: 2026-10-02T09:00:00Z');
    expect(() => dateParts('2026-10')).toThrow('not a YYYY-MM-DD date');
  });
});

describe('propertyOf — a property of any value, as `value?.[key]` reads it', () => {
  it('reads the property of an object, an error or a primitive', () => {
    expect(propertyOf({ code: 'ENOENT' }, 'code')).toBe('ENOENT');
    expect(propertyOf(new Error('boom'), 'message')).toBe('boom');
    expect(propertyOf('abc', 'length')).toBe(3);
  });

  it('reads nothing of null, undefined, or an object without the key', () => {
    expect(propertyOf(null, 'message')).toBeUndefined();
    expect(propertyOf(undefined, 'message')).toBeUndefined();
    expect(propertyOf({}, 'message')).toBeUndefined();
  });
});

describe('messageOf — whatever was thrown, read for its message', () => {
  it('gives the message of an error, or of anything carrying a string message', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
    expect(messageOf({ message: 'refused' })).toBe('refused');
  });

  it('gives the thrown value as text when it carries no string message', () => {
    expect(messageOf('plain text')).toBe('plain text');
    expect(messageOf({ message: 42 })).toBe('[object Object]');
    expect(messageOf(null)).toBe('null');
  });
});

describe('keysOf — Object.keys of a record, as its keys', () => {
  it('lists the record’s own keys', () => {
    const tint: Record<'cut' | 'burn', number> = { cut: 1, burn: 2 };
    const keys: ('cut' | 'burn')[] = keysOf(tint);
    expect(keys).toEqual(['cut', 'burn']);
  });

  it('leaves out a key the record only inherits', () => {
    const record: Record<string, number> = Object.create({ inherited: 1 });
    record['own'] = 2;
    expect(keysOf(record)).toEqual(['own']);
  });
});

describe('defined — a value a `!` only claimed, proven present', () => {
  it('returns a present value, falsy ones included', () => {
    expect(defined('a', 'the name')).toBe('a');
    expect(defined(0, 'the count')).toBe(0);
    expect(defined('', 'the title')).toBe('');
  });

  it('throws on undefined and null, naming what was missing', () => {
    const absent = (): string | undefined => undefined;
    const empty = (): string | null => null;
    expect(() => defined(absent(), 'the PRD number')).toThrow('the PRD number is missing');
    expect(() => defined(empty(), 'the feature branch')).toThrow('the feature branch is missing');
  });
});

describe('at — an item of a list that must hold it', () => {
  it('returns the item at the index, a negative one counting from the end', () => {
    expect(at(['a', 'b', 'c'], 1, 'the second slice')).toBe('b');
    expect(at(['a', 'b', 'c'], -1, 'the last slice')).toBe('c');
  });

  it('throws past either end, naming what was missing and where', () => {
    expect(() => at(['a'], 1, 'the second slice')).toThrow('the second slice is missing: no item at 1 of 1');
    expect(() => at([], -1, 'the last slice')).toThrow('the last slice is missing: no item at -1 of 0');
  });
});
