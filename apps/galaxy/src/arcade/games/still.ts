// A still of a game, as its lit cabinet's screen in the game room shows it (stills.ts holds them). The
// game room never loads a game's own engine (OMNI KART's is loaded on demand, kart/guard.test.ts), so
// each still is drawn once from the game's own pieces by stills.test.ts and kept here as text: its
// palette, and each row of its pixels as runs of one colour.
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { GridName } from '../grid';

/**
 * A still `w`×`h` pixels: each of its `rows` is a run of one colour after another, the colour as
 * letters naming its place in `palette`, then the run's length when it is longer than 1.
 */
export interface Still { w: number; h: number; palette: readonly string[]; rows: readonly string[] }

/** A game's still on each grid, sized to the inside of its screen there. */
export type Stills = Readonly<Record<GridName, Still>>;

/** The letters a colour's place in the palette is written in: one per colour up to 52 colours, two beyond. */
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** How many letters name one colour of a palette this long. */
export const letterWidth = (colours: number): number => (colours > LETTERS.length ? 2 : 1);

const isDigit = (code: number) => code >= 48 && code <= 57;

/** The still's pixels, four bytes each (red, green, blue, alpha), as an ImageData holds them. */
export function stillPixels(still: Still): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(still.w * still.h * 4);
  const rgb = still.palette.map((hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)));
  const width = letterWidth(still.palette.length);
  still.rows.forEach((row, y) => {
    let i = 0, at = y * still.w * 4;
    const end = at + still.w * 4;
    while (i < row.length) {
      let colour = 0;
      for (let d = 0; d < width; d++) colour = colour * LETTERS.length + LETTERS.indexOf(row.charAt(i++));
      let length = 0;
      while (i < row.length && isDigit(row.charCodeAt(i))) length = length * 10 + row.charCodeAt(i++) - 48;
      const [r = 0, g = 0, b = 0] = defined(rgb[colour], `colour ${colour} of the still's palette`);
      for (let n = Math.max(1, length); n > 0 && at < end; n--, at += 4) {
        out[at] = r; out[at + 1] = g; out[at + 2] = b; out[at + 3] = 255;
      }
    }
  });
  return out;
}
