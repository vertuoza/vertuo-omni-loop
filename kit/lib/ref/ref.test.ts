import { describe, expect, it } from 'vitest';
import { formatLink, formatTitle, readRef, type RefFormat } from './ref.ts';

const FORMAT: RefFormat = { title: '[{ref}]-{title}', none: '[NoRef]-{title}', link: 'https://tracker.example/{ref}' };
const TITLE = 'fix(planning): keep the day';

describe('readRef', () => {
  it('reads the ref of a marker', () => {
    expect(readRef('Text\n<!-- omni-ref: ABC-123 -->\nmore')).toBe('ABC-123');
  });

  it('is null with no marker', () => {
    expect(readRef('nothing here')).toBeNull();
  });

  it('skips a malformed first marker for a later valid one', () => {
    expect(readRef('<!-- omni-ref: ABC 123 -->\n<!-- omni-ref: DEF-4 -->')).toBe('DEF-4');
  });

  it('takes the first of two valid markers', () => {
    expect(readRef('<!-- omni-ref: A-1 -->\n<!-- omni-ref: B-2 -->')).toBe('A-1');
  });

  it('accepts 64 characters and refuses 65, and any other character', () => {
    expect(readRef(`<!-- omni-ref: ${'a'.repeat(64)} -->`)).toBe('a'.repeat(64));
    expect(readRef(`<!-- omni-ref: ${'a'.repeat(65)} -->`)).toBeNull();
    expect(readRef('<!-- omni-ref: AB/12 -->')).toBeNull();
    expect(readRef('<!-- omni-ref:  -->')).toBeNull();
    expect(readRef('<!-- omni-ref: a.b_c-1 -->')).toBe('a.b_c-1');
  });
});

describe('formatTitle', () => {
  it('leaves the title alone with no format', () => {
    expect(formatTitle(null, 'ABC-1', TITLE)).toBe(TITLE);
  });

  it('formats with a ref', () => {
    expect(formatTitle(FORMAT, 'ABC-123', TITLE)).toBe(`[ABC-123]-${TITLE}`);
  });

  it('is idempotent on a title already formatted with this ref', () => {
    expect(formatTitle(FORMAT, 'ABC-123', `[ABC-123]-${TITLE}`)).toBe(`[ABC-123]-${TITLE}`);
  });

  it('prefixes again when the title carries another ref', () => {
    expect(formatTitle(FORMAT, 'ABC-123', `[XYZ-9]-${TITLE}`)).toBe(`[ABC-123]-[XYZ-9]-${TITLE}`);
  });

  it('uses none with no ref, once', () => {
    expect(formatTitle(FORMAT, null, TITLE)).toBe(`[NoRef]-${TITLE}`);
    expect(formatTitle(FORMAT, null, `[NoRef]-${TITLE}`)).toBe(`[NoRef]-${TITLE}`);
  });

  it('leaves the title with no ref and none null', () => {
    expect(formatTitle({ ...FORMAT, none: null }, null, TITLE)).toBe(TITLE);
  });

  it('handles a format with text after {title} and keeps $ in the title literal', () => {
    const suffixed: RefFormat = { title: '{title} ({ref})', none: null, link: null };
    expect(formatTitle(suffixed, 'A-1', 'fix $& x')).toBe('fix $& x (A-1)');
    expect(formatTitle(suffixed, 'A-1', 'fix x (A-1)')).toBe('fix x (A-1)');
  });
});

describe('formatLink', () => {
  it('fills {ref}', () => {
    expect(formatLink(FORMAT, 'ABC-123')).toBe('https://tracker.example/ABC-123');
  });

  it('is null with no format, no link or no ref', () => {
    expect(formatLink(null, 'ABC-123')).toBeNull();
    expect(formatLink({ ...FORMAT, link: null }, 'ABC-123')).toBeNull();
    expect(formatLink(FORMAT, null)).toBeNull();
  });
});
