// The Omni Loop logo: the 16-bit crest. Pixel art made by the sprites' rules: the O is a loop arrow
// (a ring broken at the top right, one end sharpened into an arrowhead), the other letters are a
// chunky 5×7 pixel face drawn at 2×, and the finish is the forge's: a 4-tone ramp lit from the top
// left (highlight, yellow, orange, ember), a navy-dark outline on every edge, and a plasma-dark drop
// shadow. It comes in three forms, `full` (OMNI LOOP), `lockup` (a big O leading MNI LOOP) and
// `mark` (the O alone), plus the favicon, drawn on its own 16×16 grid rather than shrunk. Each has
// a one-colour variant: the silhouette in navy-dark, without its shadow, for a light ground or a
// single ink. Whole-number scales only: the logo is never smoothed.
/// <reference lib="dom" />
import { INK } from './palette.ts';

/** The logo's forms: OMNI LOOP, a big O leading MNI LOOP, and the O alone. */
export type LogoForm = 'full' | 'lockup' | 'mark';
/** Every drawing the logo module holds: the three forms and the favicon, drawn on its own 16×16 grid. */
export type LogoDrawing = LogoForm | 'favicon';
/** A logo drawing's pixels, row by row, `null` for empty. */
export interface LogoArt { readonly w: number; readonly h: number; readonly pixels: readonly (string | null)[] }
type Ctx = Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect'> | Pick<OffscreenCanvasRenderingContext2D, 'fillStyle' | 'fillRect'>;

/** The logo's forms. */
export const LOGO_FORMS: readonly LogoForm[] = Object.freeze<LogoForm[]>(['full', 'lockup', 'mark']);
/** Every drawing the logo module holds: the three forms and the favicon. */
export const LOGO_DRAWINGS: readonly LogoDrawing[] = Object.freeze<LogoDrawing[]>([...LOGO_FORMS, 'favicon']);

// The loop-arrow O, 16×14: the ring runs from its top end (cut at column 7) round the left, the
// bottom and up the right side, where it ends in the arrowhead pointing back up at the gap.
const LOOP_O = [
  '....####........',
  '...#####....#...',
  '..######...###..',
  '.####.....#####.',
  '####.....#######',
  '###........###..',
  '###........###..',
  '###........###..',
  '###........###..',
  '####......####..',
  '.####....####...',
  '..##########....',
  '...########.....',
  '....######......',
];

// The favicon's O, 13×13: the same loop arrow redrawn for 16 pixels, so that its gap and its
// arrowhead survive at the size a tab shows it.
const FAVICON_O = [
  '..........#..',
  '....###..###.',
  '..#####.#####',
  '.####...###..',
  '.##......##..',
  '###......###.',
  '##........##.',
  '##........##.',
  '###......###.',
  '.##......##..',
  '.####..####..',
  '..########...',
  '....####.....',
];

// The pixel face: 5×7 glyphs, drawn at 2× on the logo's grid.
const FACE: Readonly<Record<string, readonly string[]>> = {
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
};

const LETTER_GAP = 2; // between two glyphs' lit pixels: their outlines meet
const WORD_GAP = 8; // between OMNI and LOOP

/** A glyph's rows doubled `k` times each way. */
const scaled = (rows: readonly string[], k: number): string[] => rows.flatMap((r) => Array<string>(k).fill([...r].map((c) => c.repeat(k)).join('')));
const glyph = (ch: string): readonly string[] => (ch === 'O' ? LOOP_O : scaled(FACE[ch]!, 2));

/** A glyph to lay out, and the gap before it. */
type Placed = [rows: readonly string[], gap?: number];
interface Box { x: number; y: number; rows: readonly string[] }

/**
 * Lays glyphs on one line, each with its own light: `[rows, gapBefore]`, vertically centred on the
 * tallest. Returns the lit mask as glyph boxes.
 */
function line(glyphs: readonly Placed[]): { w: number; h: number; boxes: Box[] } {
  const h = Math.max(...glyphs.map(([rows]) => rows.length));
  let x = 0;
  const boxes = glyphs.map(([rows, gap = 0], i) => {
    x += i ? gap : 0;
    const box = { x, y: Math.floor((h - rows.length) / 2), rows };
    x += rows[0]!.length;
    return box;
  });
  return { w: x, h, boxes };
}

function word(text: string, first = 0): Placed[] {
  return [...text].map((ch, i): Placed => [glyph(ch), i === 0 ? first : LETTER_GAP]);
}

// Each drawing: its glyphs laid out, and the drop shadow's offset.
const LAYOUTS: Readonly<Record<LogoDrawing, () => { w: number; h: number; boxes: Box[]; shadow: number }>> = {
  full: () => ({ ...line([...word('OMNI'), ...word('LOOP', WORD_GAP)]), shadow: 2 }),
  lockup: () => ({ ...line([[scaled(LOOP_O, 2)], ...word('MNI', 2 * LETTER_GAP), ...word('LOOP', WORD_GAP)]), shadow: 2 }),
  mark: () => ({ ...line([[LOOP_O]]), shadow: 2 }),
  favicon: () => ({ ...line([[FAVICON_O]]), shadow: 1 }),
};

const RAMP = [INK.highlight, INK.yellow, INK.orange, INK.ember];

/** The ramp tone of a glyph's pixel: lit from the top left, mostly from above. */
function tone(x: number, y: number, w: number, h: number): string {
  const s = (x + 3 * y) / Math.max(1, w - 1 + 3 * (h - 1));
  return RAMP[Math.min(3, Math.floor(s * 4))]!;
}

const cache = new Map<string, LogoArt>();

/**
 * A logo drawing as pixels: `{ w, h, pixels }`, row by row, `null` for empty, like a forged sprite.
 * `mono` gives the one-colour variant.
 */
export function logoPixels(form: LogoDrawing, { mono = false }: { mono?: boolean } = {}): LogoArt {
  if (!LOGO_DRAWINGS.includes(form)) throw new Error(`unknown logo form ${form}`);
  const key = `${form}|${mono}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { w: lw, h: lh, boxes, shadow } = LAYOUTS[form]();
  const pad = 1; // the outline
  const w = lw + 2 * pad + shadow, h = lh + 2 * pad + shadow;
  const lit = Array<string | null>(w * h).fill(null);
  for (const { x: bx, y: by, rows } of boxes) {
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '#') lit[(by + y + pad) * w + bx + x + pad] = tone(x, y, row.length, rows.length);
    }));
  }
  const has = (arr: readonly (string | null)[], x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && arr[y * w + x] !== null;
  // The outline: every empty pixel that touches a lit one, corners included.
  const body = lit.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (has(lit, x, y)) continue;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (has(lit, x + dx, y + dy)) { edge = true; break; }
    if (edge) body[y * w + x] = INK.navyDark;
  }
  let pixels: (string | null)[];
  if (mono) {
    pixels = body.map((c) => (c ? INK.navyDark : null));
  } else {
    // The drop shadow: the silhouette moved down and right, behind it.
    pixels = body.map((c, i) => c ?? (has(body, (i % w) - shadow, Math.floor(i / w) - shadow) ? INK.plasmaDark : null));
  }
  const art = Object.freeze({ w, h, pixels: Object.freeze(pixels) });
  cache.set(key, art);
  return art;
}

function wholeScale(scale: number): number {
  if (!Number.isInteger(scale) || scale < 1) throw new Error(`the logo scales by a whole number, not ${scale}`);
  return scale;
}

/** Each colour's horizontal runs: `[x, y, length]`. */
function runsByColour({ w, h, pixels }: LogoArt): Map<string, [number, number, number][]> {
  const out = new Map<string, [number, number, number][]>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w;) {
      const c = pixels[y * w + x];
      let n = 1;
      while (x + n < w && pixels[y * w + x + n] === c) n++;
      if (c) {
        let runs = out.get(c);
        if (!runs) { runs = []; out.set(c, runs); }
        runs.push([x, y, n]);
      }
      x += n;
    }
  }
  return out;
}

const ENTITIES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escape = (s: string): string => s.replace(/[&<>"]/g, (c) => ENTITIES[c]!);

/**
 * A logo drawing as a crisp SVG string, `scale` times its pixels (a whole number), never smoothed.
 * `title` names it for a screen reader; without one the SVG is decorative.
 */
export function logoSvg(form: LogoDrawing, { scale = 1, mono = false, title = null }: { scale?: number; mono?: boolean; title?: string | null } = {}): string {
  const k = wholeScale(scale);
  const art = logoPixels(form, { mono });
  const paths = [...runsByColour(art)].map(([c, runs]) =>
    `<path fill="${c}" d="${runs.map(([x, y, n]) => `M${x} ${y}h${n}v1h-${n}z`).join('')}"/>`);
  const label = title ? ` role="img" aria-label="${escape(title)}"><title>${escape(title)}</title>` : ' aria-hidden="true">';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${art.w * k}" height="${art.h * k}" viewBox="0 0 ${art.w} ${art.h}" shape-rendering="crispEdges"${label}${paths.join('')}</svg>`;
}

/**
 * Draws a logo drawing on a canvas with its top left at (`x`, `y`), `scale` canvas pixels a pixel.
 * `reveal` (0 to 1) draws only that share of its columns, from the left, rounded up to a whole one.
 */
export function drawLogo(ctx: Ctx, form: LogoDrawing, x: number, y: number, { scale = 1, mono = false, reveal = 1 }: { scale?: number; mono?: boolean; reveal?: number } = {}): void {
  const k = wholeScale(scale);
  x = Math.round(x); y = Math.round(y);
  const art = logoPixels(form, { mono });
  const cols = Math.ceil(art.w * Math.min(1, Math.max(0, reveal)));
  for (const [c, runs] of runsByColour(art)) {
    ctx.fillStyle = c;
    for (const [rx, ry, n] of runs) {
      const shown = Math.min(n, cols - rx);
      if (shown > 0) ctx.fillRect(x + rx * k, y + ry * k, shown * k, k);
    }
  }
}
