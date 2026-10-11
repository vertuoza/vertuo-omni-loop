// PRD 1584, s2: `design.words.content` — the selector of the text a screen shows rather than writes.
// Optional in the config, like `design.ignore`: its default is applied here, where it is read.
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../config.ts';
import { DEFAULT_WORDS_CONTENT, wordsContent } from './content.ts';

describe('design.words.content', () => {
  it('reads [data-content] when the config does not set it', () => {
    expect(DEFAULT_WORDS_CONTENT).toBe('[data-content]');
    expect(wordsContent(parseConfig('kit: 1\n').design.words)).toBe('[data-content]');
  });

  it("reads the repository's own selector when it sets one", () => {
    expect(wordsContent(parseConfig('kit: 1\ndesign:\n  words:\n    content: ".data, [data-shown]"\n').design.words)).toBe('.data, [data-shown]');
  });

  it('refuses a selector the word pass cannot read', () => {
    expect(() => parseConfig('kit: 1\ndesign:\n  words:\n    content: "main > p"\n')).toThrow(/design\.words\.content.*combinator/s);
  });
});
