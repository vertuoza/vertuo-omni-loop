import { describe, expect, it } from 'vitest';
import { LETTERS, letterOf, MARK_SIZE, markFor, type Letter, type Run } from './mark';
import { sure } from './sure';

// Today's V, pixel for pixel: the runs the boot screen drew before the mark took a brand's letter,
// as [x, y, width, row of bars]. Four rows of bars, 10 pixels apart, each a 6-pixel pill.
const TODAYS_V: Run[] = [
  [2, 0, 18, 0], [1, 1, 20, 0], [0, 2, 22, 0], [0, 3, 22, 0], [1, 4, 20, 0], [2, 5, 18, 0],
  [26, 0, 8, 0], [25, 1, 10, 0], [24, 2, 12, 0], [24, 3, 12, 0], [25, 4, 10, 0], [26, 5, 8, 0],
  [6, 10, 4, 1], [5, 11, 6, 1], [4, 12, 8, 1], [4, 13, 8, 1], [5, 14, 6, 1], [6, 15, 4, 1],
  [16, 10, 14, 1], [15, 11, 16, 1], [14, 12, 18, 1], [14, 13, 18, 1], [15, 14, 16, 1], [16, 15, 14, 1],
  [10, 20, 8, 2], [9, 21, 10, 2], [8, 22, 12, 2], [8, 23, 12, 2], [9, 24, 10, 2], [10, 25, 8, 2],
  [24, 20, 2, 2], [23, 21, 4, 2], [22, 22, 6, 2], [22, 23, 6, 2], [23, 24, 4, 2], [24, 25, 2, 2],
  [14, 30, 8, 3], [13, 31, 10, 3], [12, 32, 12, 3], [12, 33, 12, 3], [13, 34, 10, 3], [14, 35, 8, 3],
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as Letter[];

/** The pixels a mark lights, as "x,y" keys. */
const pixels = (runs: readonly Run[]) => new Set(runs.flatMap(([x, y, w]) => Array.from({ length: w }, (_, i) => `${x + i},${y}`)));

describe('the mark', () => {
  it('draws Vertuoza with today\'s V, pixel for pixel, in today\'s colours', () => {
    const mark = markFor('Vertuoza');
    expect(mark.runs).toEqual(TODAYS_V);
    expect(mark.size).toBe(36);
    expect(MARK_SIZE).toBe(36);
    expect(mark.stops).toEqual([[0, '#ff5f6d'], [0.55, '#a45cff'], [1, '#4a63ff']]);
    expect(mark.shade).toEqual([[0, '#a8183a'], [0.55, '#6a2fd0'], [1, '#2f3fc4']]);
  });

  it('has a letter for every one of A to Z', () => {
    expect(Object.keys(LETTERS).sort()).toEqual(ALPHABET);
  });

  it('keeps every letter inside the 36×36 box', () => {
    for (const letter of ALPHABET) {
      const { runs } = markFor(letter);
      expect(runs.length, letter).toBeGreaterThan(0);
      for (const [x, y, w] of runs) {
        expect(w, `${letter}: a run of no width`).toBeGreaterThan(0);
        expect(x, letter).toBeGreaterThanOrEqual(0);
        expect(x + w, letter).toBeLessThanOrEqual(36);
        expect(y, letter).toBeGreaterThanOrEqual(0);
        expect(y, letter).toBeLessThan(36);
      }
    }
  });

  it('draws every letter in the V\'s bars: 6-pixel pills with the same stepped caps, apart from one another', () => {
    const CAP = [2, 1, 0, 0, 1, 2];
    for (const letter of ALPHABET) {
      const { runs } = markFor(letter);
      expect(runs.length % 6, letter).toBe(0);
      const bars: { x: number; y: number; w: number; row: number }[] = [];
      for (let i = 0; i < runs.length; i += 6) {
        const pill = runs.slice(i, i + 6);
        const [x, y, , row] = sure(pill[2], 'pill[2]');
        const w = sure(pill[2], 'pill[2]')[2];
        pill.forEach(([px, py, pw, prow], line) => {
          expect([px, py, pw, prow], `${letter}, bar at ${x},${y}, line ${line}`).toEqual([x + sure(CAP[line], 'CAP[line]'), y - 2 + line, w - 2 * sure(CAP[line], 'CAP[line]'), row]);
        });
        bars.push({ x, y: y - 2, w, row });
      }
      // Two bars of one row never touch: a row is split bars, never one smeared stroke.
      for (const a of bars) for (const b of bars) {
        if (a === b || a.row !== b.row) continue;
        expect(a.y, `${letter}: one row, one height`).toBe(b.y);
        expect(a.x + a.w < b.x || b.x + b.w < a.x, `${letter}: bars at ${a.x} and ${b.x} of row ${a.row} touch`).toBe(true);
      }
      // Rows go down the box one after the other, never overlapping.
      const tops = [...new Set(bars.map((b) => b.row))].sort((m, n) => m - n).map((row) => sure(bars.find((b) => b.row === row), 'bars.find((b) => b.row === row)').y);
      tops.slice(1).forEach((top, i) => { expect(top - sure(tops[i], 'tops[i]'), `${letter}: rows ${i} and ${i + 1}`).toBeGreaterThan(6); });
    }
  });

  it('gives every letter a shape of its own', () => {
    const shapes = new Map<string, Letter>();
    for (const letter of ALPHABET) {
      const key = [...pixels(markFor(letter).runs)].sort().join(' ');
      expect(shapes.get(key), `${letter} is drawn like ${shapes.get(key)}`).toBeUndefined();
      shapes.set(key, letter);
    }
  });
});

describe('the letter of a name', () => {
  it('is its first letter, upper-cased', () => {
    expect(letterOf('Vertuoza')).toBe('V');
    expect(letterOf('Acme')).toBe('A');
    expect(letterOf('acme')).toBe('A');
    expect(letterOf('zeta')).toBe('Z');
    expect(markFor('Acme').runs).toEqual(markFor('A').runs);
    expect(markFor('acme').runs).toEqual(markFor('A').runs);
  });

  it('is taken without its accent', () => {
    expect(letterOf('Élan')).toBe('E');
    expect(letterOf('élan')).toBe('E');
    expect(letterOf('Çava')).toBe('C');
    expect(markFor('Élan').runs).toEqual(markFor('E').runs);
  });

  it('is O, for Omni, when the name does not start with A to Z', () => {
    for (const name of ['42 Labs', '', ' Acme', '#hash', 'Ωmega', 'Æther', '🚀 Rocket']) {
      expect(letterOf(name), JSON.stringify(name)).toBe('O');
      expect(markFor(name).runs, JSON.stringify(name)).toEqual(markFor('O').runs);
    }
  });
});
