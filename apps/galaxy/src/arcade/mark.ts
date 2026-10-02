// The mark: the first letter of the brand's name in split bars, coral to blue. A bar alphabet, A to
// Z, drawn in the V's style: horizontal pills 6 pixels tall with stepped round ends, on the V's
// 36-pixel grid, under its gradient and its shade. The V is the Vertuoza mark as it always was. The
// boot screen, and the intro's first bars, draw whichever letter they are given (`markFor`), in the
// theme's `mark-1` to `mark-3` and `mark-shade-1` to `mark-shade-3` (theme.ts).
import { DEFAULT_THEME, type Theme } from './theme';
import { isOneOf, keysOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

export const MARK_SIZE = 36;

/** One pixel line of a bar, [x, y, width, row of bars]: a mark is drawn line by line. */
export type Run = readonly [x: number, y: number, w: number, row: number];
/** A gradient stop across the mark, left to right: [offset, colour]. */
export type Stop = readonly [offset: number, color: string];

/** A mark as it is drawn: its box, its pixel lines, its gradient and the darker shade under it. */
export interface Mark {
  readonly size: number;
  readonly runs: readonly Run[];
  readonly stops: readonly Stop[];
  readonly shade: readonly Stop[];
}

/** A bar of a row, [x, width] on the 36-pixel grid. */
type Bar = readonly [x: number, w: number];
/** A letter: its rows of bars, top to bottom, the first row's y and how far apart the rows are. */
interface Glyph { readonly rows: readonly (readonly Bar[])[]; readonly top: number; readonly pitch: number }

// How far each pixel line of a bar is inset at both ends: a 6-pixel-tall pill with stepped round ends.
const CAP = [2, 1, 0, 0, 1, 2];

// The V: four rows of bars, 10 pixels apart, that narrow row by row. Every other letter needs a
// middle stroke the V has not, so it takes five rows, 7 pixels apart: the box from y 1 to 35.
const V: Glyph = { top: 0, pitch: 10, rows: [[[0, 22], [24, 12]], [[4, 8], [14, 18]], [[8, 12], [22, 6]], [[12, 12]]] };
const five = (...rows: (readonly Bar[])[]): Glyph => ({ top: 1, pitch: 7, rows });

// The strokes most letters share: the left stem, the right stem, the middle one, and a full bar.
const L: Bar = [0, 11], R: Bar = [25, 11], C: Bar = [12, 12], F: Bar = [0, 36];

/** The bar alphabet. */
export const LETTERS = {
  A: five([[8, 20]], [[3, 11], [22, 11]], [F], [L, R], [L, R]),
  B: five([[0, 31]], [L, [24, 11]], [[0, 31]], [L, R], [[0, 33]]),
  C: five([[4, 32]], [L], [L], [L], [[4, 32]]),
  D: five([[0, 28]], [L, [23, 12]], [L, R], [L, [23, 12]], [[0, 28]]),
  E: five([F], [L], [[0, 28]], [L], [F]),
  F: five([F], [L], [[0, 28]], [L], [L]),
  G: five([[4, 32]], [L], [L, [18, 18]], [L, R], [[4, 32]]),
  H: five([L, R], [L, R], [F], [L, R], [L, R]),
  I: five([[6, 24]], [C], [C], [C], [[6, 24]]),
  J: five([[10, 26]], [R], [R], [L, R], [[4, 28]]),
  K: five([L, [24, 12]], [L, [16, 12]], [[0, 23]], [L, [16, 12]], [L, [24, 12]]),
  L: five([L], [L], [L], [L], [F]),
  M: five([[0, 14], [22, 14]], [[0, 16], [20, 16]], [[0, 10], [13, 10], [26, 10]], [L, R], [L, R]),
  N: five([[0, 14], R], [[0, 18], R], [L, [13, 10], R], [L, [18, 18]], [L, [22, 14]]),
  O: five([[5, 26]], [[1, 11], [24, 11]], [L, R], [[1, 11], [24, 11]], [[5, 26]]),
  P: five([[0, 31]], [L, R], [[0, 31]], [L], [L]),
  Q: five([[5, 26]], [[1, 11], [24, 11]], [L, R], [[1, 11], [16, 19]], [[5, 22], [29, 7]]),
  R: five([[0, 31]], [L, R], [[0, 31]], [L, [18, 12]], [L, R]),
  S: five([[4, 32]], [L], [[4, 28]], [R], [[0, 32]]),
  T: five([F], [C], [C], [C], [C]),
  U: five([L, R], [L, R], [L, R], [L, R], [[4, 28]]),
  V,
  W: five([L, R], [L, R], [[0, 10], [13, 10], [26, 10]], [[0, 16], [20, 16]], [[0, 14], [22, 14]]),
  X: five([L, R], [[4, 12], [20, 12]], [C], [[4, 12], [20, 12]], [L, R]),
  Y: five([L, R], [[4, 12], [20, 12]], [C], [C], [C]),
  Z: five([F], [[22, 13]], [[12, 12]], [[1, 13]], [F]),
} as const satisfies Record<string, Glyph>;

export type Letter = keyof typeof LETTERS;

/** A letter as pixel lines: each bar, line by line, inset by its caps. */
function runsOf({ rows, top, pitch }: Glyph): Run[] {
  return rows.flatMap((bars, row) =>
    bars.flatMap(([x, w]) => CAP.map((c, line) => [x + c, top + row * pitch + line, w - 2 * c, row] as const)));
}

const RUNS = new Map<Letter, readonly Run[]>();

/**
 * The letter a name is drawn with: its first character, upper-cased and without its accent. A name
 * that does not start with A to Z gets O, for Omni.
 */
export function letterOf(name: string): Letter {
  const first = name.normalize('NFD').charAt(0).toUpperCase();
  return isOneOf(keysOf(LETTERS), first) ? first : 'O';
}

/** The mark of a name: its letter, in the theme's gradient (`mark-1` to `mark-3`) and shade (`mark-shade-1` to `mark-shade-3`). */
export function markFor(name: string, theme: Theme = DEFAULT_THEME): Mark {
  const letter = letterOf(name);
  let runs = RUNS.get(letter);
  if (!runs) RUNS.set(letter, (runs = runsOf(LETTERS[letter])));
  const stops: Stop[] = [[0, theme['mark-1']], [0.55, theme['mark-2']], [1, theme['mark-3']]];
  const shade: Stop[] = [[0, theme['mark-shade-1']], [0.55, theme['mark-shade-2']], [1, theme['mark-shade-3']]];
  return { size: MARK_SIZE, runs, stops, shade };
}
