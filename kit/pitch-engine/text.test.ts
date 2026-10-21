// A title built word by word (PRD 1108 s4): each word springs up from blurred to sharp, one after the
// other, so a title's state at any frame is known. Its accent (PRD 2030 s1): `**word**` marks the words
// drawn in the accent, and a final full stop takes the accent too.
import { describe, expect, it } from 'vitest';
import { WORD_STAGGER, parseTitle, revealEnd, titleWords, wordState } from './text.ts';

describe('titleWords', () => {
  it('splits a title on its spaces, keeping punctuation with its word', () => {
    expect(titleWords('  Quotes that   send themselves. ')).toEqual(['Quotes', 'that', 'send', 'themselves.']);
    expect(titleWords('')).toEqual([]);
  });

  it('leaves the accent markers out of the words', () => {
    expect(titleWords('Invoice straight from the **worksite**.')).toEqual(['Invoice', 'straight', 'from', 'the', 'worksite.']);
    expect(titleWords('Three clicks, ** one invoice**.')).toEqual(['Three', 'clicks,', 'one', 'invoice.']);
  });
});

describe('parseTitle', () => {
  it('flags the marked word as the accent and tints the final stop, with no marker left', () => {
    expect(parseTitle('Invoice straight from the **worksite**.')).toEqual({
      words: [
        { text: 'Invoice', accent: false },
        { text: 'straight', accent: false },
        { text: 'from', accent: false },
        { text: 'the', accent: false },
        { text: 'worksite', accent: true },
      ],
      stop: true,
    });
  });

  it('accents every word of a few marked together, and only those', () => {
    expect(parseTitle('Three clicks, **one invoice**.').words).toEqual([
      { text: 'Three', accent: false },
      { text: 'clicks,', accent: false },
      { text: 'one', accent: true },
      { text: 'invoice', accent: true },
    ]);
  });

  it('keeps a stop the accent holds as the final stop, and a title with no stop has none', () => {
    expect(parseTitle('Straight from the **worksite.**')).toEqual({ words: [{ text: 'Straight', accent: false }, { text: 'from', accent: false }, { text: 'the', accent: false }, { text: 'worksite', accent: true }], stop: true });
    expect(parseTitle('Quotes that send themselves')).toEqual({ words: ['Quotes', 'that', 'send', 'themselves'].map((text) => ({ text, accent: false })), stop: false });
  });

  it('takes an ellipsis, a question or a stop in the middle as words, not as the final stop', () => {
    expect(parseTitle('Wait for it...')).toMatchObject({ stop: false, words: [{ text: 'Wait' }, { text: 'for' }, { text: 'it...' }] });
    expect(parseTitle('Ready?').stop).toBe(false);
    expect(parseTitle('One. Two').words.map((word) => word.text)).toEqual(['One.', 'Two']);
  });

  it('accents nothing after a marker left open, and drops it', () => {
    expect(parseTitle('Invoice from the **worksite.')).toEqual({ words: ['Invoice', 'from', 'the', 'worksite'].map((text) => ({ text, accent: false })), stop: true });
  });

  it('holds a stop standing alone as the final stop, and nothing for an empty title', () => {
    expect(parseTitle('Done .')).toEqual({ words: [{ text: 'Done', accent: false }], stop: true });
    expect(parseTitle('  ')).toEqual({ words: [], stop: false });
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

  it('counts the words without their markers', () => {
    expect(revealEnd('One **two** three', 0.2)).toBe(revealEnd('One two three', 0.2));
    expect(revealEnd('One ** two** three', 0.2)).toBe(revealEnd('One two three', 0.2));
  });
});
