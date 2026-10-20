import { describe, expect, it } from 'vitest';
import { CELL_HEIGHT, CELL_WIDTH, glyphOf } from './font.ts';

/** A glyph as the 13 rows of 6 columns it is drawn in. */
const rowsOf = (character: string): string[] =>
  glyphOf(character).map((bits) =>
    Array.from({ length: CELL_WIDTH }, (_column, index) => (bits & (1 << (CELL_WIDTH - 1 - index)) ? '#' : '.')).join(''),
  );

const ASCII = Array.from({ length: 95 }, (_value, index) => String.fromCharCode(32 + index));
const MARKS = Array.from('✓✗×❯›·•→─│');

describe('the 6x13 font', () => {
  it('is a cell of 13 rows and 6 columns for every character', () => {
    expect(CELL_WIDTH).toBe(6);
    expect(CELL_HEIGHT).toBe(13);
    for (const character of [...ASCII, ...MARKS, 'é', '日']) {
      const glyph = glyphOf(character);
      expect(glyph).toHaveLength(13);
      expect(glyph.every((bits) => Number.isInteger(bits) && bits >= 0 && bits < 64)).toBe(true);
    }
  });

  it('draws every ASCII character and every mark itself, and a space blank', () => {
    const unknown = rowsOf('?').join('/');
    for (const character of [...ASCII, ...MARKS].filter((one) => one !== '?')) {
      expect(rowsOf(character).join('/'), `the glyph of ${character}`).not.toBe(unknown);
    }
    expect(rowsOf(' ').every((row) => row === '......')).toBe(true);
    expect(glyphOf('!').some((bits) => bits !== 0)).toBe(true);
  });

  it('gives each character its own picture', () => {
    const pictures = new Set([...ASCII, ...MARKS].map((character) => rowsOf(character).join('/')));
    expect(pictures.size).toBe(ASCII.length + MARKS.length);
  });

  it('draws any other character as a question mark', () => {
    for (const character of ['é', '日', '😀', '\u0007', '']) expect(glyphOf(character)).toEqual(glyphOf('?'));
  });

  it('draws a capital A on rows 2 to 10, from its picture', () => {
    expect(rowsOf('A')).toEqual([
      '......',
      '......',
      '..#...',
      '.#.#..',
      '#...#.',
      '#...#.',
      '#...#.',
      '#####.',
      '#...#.',
      '#...#.',
      '#...#.',
      '......',
      '......',
    ]);
  });

  it('puts capitals and digits on rows 2 to 10, lowercase on 4 to 10 and a descender on to row 12', () => {
    const inked = (character: string): number[] => rowsOf(character).flatMap((row, index) => (row.includes('#') ? [index] : []));
    expect([inked('H')[0], inked('H').at(-1)]).toEqual([2, 10]);
    expect([inked('7')[0], inked('7').at(-1)]).toEqual([2, 10]);
    expect([inked('x')[0], inked('x').at(-1)]).toEqual([4, 10]);
    expect([inked('p')[0], inked('p').at(-1)]).toEqual([4, 12]);
    expect([inked('b')[0], inked('b').at(-1)]).toEqual([2, 10]);
  });

  it('draws the box lines across the whole cell so they join their neighbours', () => {
    expect(rowsOf('─')).toEqual(Array.from({ length: 13 }, (_row, index) => (index === 6 ? '######' : '......')));
    expect(rowsOf('│')).toEqual(Array.from({ length: 13 }, () => '..#...'));
  });
});
