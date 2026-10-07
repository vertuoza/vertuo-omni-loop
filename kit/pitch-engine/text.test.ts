// A title built word by word (PRD 1108 s4): each word springs up from blurred to sharp, one after the
// other, so a title's state at any frame is known.
import { describe, expect, it } from 'vitest';
import { WORD_STAGGER, revealEnd, titleWords, wordState } from './text.ts';

describe('titleWords', () => {
  it('splits a title on its spaces, keeping punctuation with its word', () => {
    expect(titleWords('  Quotes that   send themselves. ')).toEqual(['Quotes', 'that', 'send', 'themselves.']);
    expect(titleWords('')).toEqual([]);
  });
});

describe('wordState', () => {
  const at = (frame: number, index: number) => wordState(frame, index, 30, { delay: 0.3 });

  it('hides a word, blurred and lowered, before its turn', () => {
    expect(at(0, 0)).toMatchObject({ progress: 0, opacity: 0, blur: 14 });
    expect(at(0, 0).rise).toBeCloseTo(0.42, 6);
    expect(at(9, 0).opacity).toBe(0);
  });

  it('starts each word a stagger after the one before it', () => {
    const start = 0.3 * 30;
    const second = start + WORD_STAGGER * 30;
    expect(at(Math.ceil(start) + 1, 0).progress).toBeGreaterThan(0);
    expect(at(Math.floor(second), 1).progress).toBe(0);
    expect(at(Math.ceil(second) + 1, 1).progress).toBeGreaterThan(0);
    expect(at(15, 0).progress).toBeGreaterThan(at(15, 1).progress);
  });

  it('is sharp, in place and opaque once its spring has settled', () => {
    const settled = at(120, 3);
    expect(settled.opacity).toBe(1);
    expect(settled.blur).toBe(0);
    expect(settled.rise).toBeCloseTo(0, 3);
  });

  it('is half revealed between its start and its end: rising, still a little blurred', () => {
    const middle = at(16, 0);
    expect(middle.progress).toBeGreaterThan(0.2);
    expect(middle.progress).toBeLessThan(0.95);
    expect(middle.blur).toBeGreaterThan(0);
    expect(middle.rise).toBeGreaterThan(0);
  });
});

describe('revealEnd', () => {
  it('is when the last word has started, plus a beat', () => {
    expect(revealEnd('One two three', 0.2)).toBeCloseTo(0.2 + 3 * WORD_STAGGER + 0.15, 6);
  });
});
