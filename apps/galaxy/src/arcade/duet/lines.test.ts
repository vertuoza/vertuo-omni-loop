import { describe, expect, it } from 'vitest';
import { CHAPTER_LINES, ENDLESS_LINES, lineOf } from './lines';
import { CHAPTERS } from './waves';

// OMNI DUET's lines (issue 1692): one of the game's own short lines for every chapter wave, and a few
// for endless mode, each fitting one line across the playfield.

describe('the lines', () => {
  it('give every chapter wave its own line, and endless mode a few in turn', () => {
    expect(CHAPTER_LINES.map((c) => c.length)).toEqual(CHAPTERS.map((c) => c.waves.length));
    CHAPTERS.forEach((c, i) => {
      c.waves.forEach((_, k) => {
        expect(lineOf({ chapter: i, wave: k, endless: false }), `${c.name} wave ${k + 1}`).not.toBe('');
      });
    });
    expect(ENDLESS_LINES.length).toBeGreaterThanOrEqual(4);
    expect(lineOf({ chapter: 3, wave: 0, endless: true })).toBe(ENDLESS_LINES[0]);
    expect(lineOf({ chapter: 3, wave: ENDLESS_LINES.length, endless: true })).toBe(ENDLESS_LINES[0]);
  });

  it('keep each line short, 40 characters at most, and never say one twice', () => {
    const all = [...CHAPTER_LINES.flat(), ...ENDLESS_LINES];
    for (const line of all) {
      expect(line.length, line).toBeLessThanOrEqual(40);
      expect(line.trim(), line).toBe(line);
    }
    expect(new Set(all).size).toBe(all.length);
  });
});
