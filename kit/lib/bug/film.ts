// The before/after GIF of a bug fix and the run folder around it (`omni bug film`, PRD 1972, PRD 2100).
// Two outputs of the reproduction (`.txt`, red then green) become two cards, drawn here in pure code
// with the kit's own font and GIF encoder: no ffmpeg. Two clips (`.webm`) become the two clips,
// captioned, through `filmArgs`, the ffmpeg arguments. `runJson` is the folder's `run.json`, in the
// shape `readRun()` accepts.
import { extname } from 'node:path';
import { CELL_HEIGHT, CELL_WIDTH, glyphOf } from '../image/font.ts';
import { encodeGif } from '../image/gif.ts';

/**
 * The cards' layout, in pixels: a title band, then up to `lines` lines of at most `columns`
 * characters in the 6x13 font, one line every `pitch` pixels from `textTop`, `margin` in from the
 * left. 100 columns of 6 pixels and two margins of 20 fill the card's 640 exactly.
 */
export const CARD = { width: 640, height: 360, band: 40, margin: 20, textTop: 54, pitch: 14, lines: 20, columns: 100 } as const;
/** How long each card is held, in the GIF's hundredths of a second. */
const CARD_DELAY = 300;
/** The title's scale: twice the font. */
const TITLE_SCALE = 2;

const CLIP_SECONDS = 4;
const GIF_WIDTH = 640;
const GIF_FPS = 10;

const RED_TITLE = 'Before the fix · red';
const GREEN_TITLE = 'After the fix · green';
const BEFORE_CAPTION = 'Before the fix';
const AFTER_CAPTION = 'After the fix';
const RED_CRITERION = 'Before the fix, the reproduction fails';
const GREEN_CRITERION = 'After the fix, the reproduction passes';

/** The kind of the two inputs: `text` for two `.txt`, `clips` for two `.webm`, else null (a mix, or another type). */
export function filmKind(before: string, after: string): 'text' | 'clips' | null {
  const [one, two] = [before, after].map((file) => extname(file).toLowerCase());
  if (one === '.txt' && two === '.txt') return 'text';
  if (one === '.webm' && two === '.webm') return 'clips';
  return null;
}

/** A path or text as ffmpeg's filter syntax reads it inside a single-quoted option value. */
function escapeFilter(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

const PALETTE = 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse';

/**
 * The ffmpeg arguments that make the GIF of two clips (`.webm`): each is read up to `CLIP_SECONDS`
 * and captioned, and both end as one `GIF_WIDTH`-wide GIF at `GIF_FPS` frames a second, looping.
 */
export function filmArgs({ before, after, out }: { before: string; after: string; out: string }): string[] {
  const clip = (index: number, caption: string): string =>
    `[${index}:v]fps=${GIF_FPS},scale=${GIF_WIDTH}:360:force_original_aspect_ratio=decrease,pad=${GIF_WIDTH}:360:(ow-iw)/2:(oh-ih)/2,setsar=1,` +
    `drawtext=font=monospace:text='${escapeFilter(caption)}':fontcolor=white:fontsize=20:box=1:boxcolor=0x000000AA:boxborderw=6:x=12:y=12[c${index}]`;
  const graph = `${clip(0, BEFORE_CAPTION)};${clip(1, AFTER_CAPTION)};[c0][c1]concat=n=2:v=1:a=0,${PALETTE}`;
  return ['-y', '-t', String(CLIP_SECONDS), '-i', before, '-t', String(CLIP_SECONDS), '-i', after, '-filter_complex', graph, '-loop', '0', out];
}

const RED_LINE = /fail|error|exception|assert|✗|✕|red/i;
const GREEN_LINE = /pass|ok\b|✓|✔|green|success/i;
const NOTE_MAX = 200;

/** Terminal control sequences: colours and cursor moves (CSI), titles (OSC), and the short escapes. */
const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[ -/]*[0-~])/g;

/** `output` as text: its ANSI escape sequences dropped, then its carriage returns. */
const plain = (output: string): string => output.replace(ANSI, '').replace(/\r/g, '');

/** Where in `lines` the first one that `pattern` matches is, else the first that is not blank, else -1. */
function firstMatch(lines: readonly string[], pattern: RegExp): number {
  const found = lines.findIndex((line) => pattern.test(line));
  return found === -1 ? lines.findIndex((line) => line.trim() !== '') : found;
}

export type CardKind = 'red' | 'green';
const MARKER = { red: RED_LINE, green: GREEN_LINE } as const;

/**
 * What a card shows of a reproduction's `output`: its lines (ANSI sequences and carriage returns
 * dropped, tabs two spaces, each cut to `CARD.columns` characters) and the index among them of the
 * line to highlight, the first failing one (`red`) or the first passing one (`green`), else the
 * first that is not blank, `null` for an empty output. The card holds the last `CARD.lines` lines;
 * when the highlighted line sits above them, it starts two lines above it, so a vitest or PHPUnit
 * assertion stays in view.
 */
export function cardLines(output: string, kind: CardKind): { lines: string[]; highlight: number | null } {
  const text = plain(output).replace(/\s+$/, '');
  const all = text === '' ? [] : text.split('\n').map((line) => line.replace(/\t/g, '  '));
  const target = firstMatch(all, MARKER[kind]);
  const last = Math.max(0, all.length - CARD.lines);
  const start = target !== -1 && target < last ? Math.max(0, target - 2) : last;
  const lines = all.slice(start, start + CARD.lines).map((line) => Array.from(line).slice(0, CARD.columns).join(''));
  return { lines, highlight: target === -1 ? null : target - start };
}

/** The colours of a card: seven in all (these three, and each kind's band and highlight), under the table's eight. */
const BACKGROUND = 0x111111;
const TEXT = 0xdddddd;
const WHITE = 0xffffff;
const CARDS = {
  red: { title: RED_TITLE, band: 0x9b1c1c, accent: 0xff6b6b },
  green: { title: GREEN_TITLE, band: 0x15803d, accent: 0x4ade80 },
} as const;

/** Draws `text` with its top left at `x`, `y`, each pixel of the font a `scale` by `scale` square. */
function drawText(pixels: Uint32Array, text: string, x: number, y: number, colour: number, scale: number): void {
  let left = x;
  for (const character of text) {
    glyphOf(character).forEach((bits, row) => {
      for (let column = 0; column < CELL_WIDTH; column += 1) {
        if ((bits & (1 << (CELL_WIDTH - 1 - column))) === 0) continue;
        for (let dy = 0; dy < scale; dy += 1) {
          const from = (y + row * scale + dy) * CARD.width + left + column * scale;
          pixels.fill(colour, from, from + scale);
        }
      }
    });
    left += CELL_WIDTH * scale;
  }
}

/** One card: the `kind`'s title on its band, then the lines of `output`, the highlighted one in colour. Pixels are 0xRRGGBB. */
export function renderCard(kind: CardKind, output: string): Uint32Array {
  const { title, band, accent } = CARDS[kind];
  const pixels = new Uint32Array(CARD.width * CARD.height).fill(BACKGROUND);
  pixels.fill(band, 0, CARD.band * CARD.width);
  drawText(pixels, title, CARD.margin, (CARD.band - CELL_HEIGHT * TITLE_SCALE) / 2, WHITE, TITLE_SCALE);
  const { lines, highlight } = cardLines(output, kind);
  lines.forEach((line, index) => {
    drawText(pixels, line, CARD.margin, CARD.textTop + index * CARD.pitch, index === highlight ? accent : TEXT, 1);
  });
  return pixels;
}

/** The GIF of a bug fix from the two outputs of its reproduction: the red card, then the green, each held 3 seconds, looping. Same outputs, same bytes. */
export function filmGif(red: string, green: string): Uint8Array {
  return encodeGif({
    width: CARD.width,
    height: CARD.height,
    frames: [
      { pixels: renderCard('red', red), delay: CARD_DELAY },
      { pixels: renderCard('green', green), delay: CARD_DELAY },
    ],
  });
}

/** The first line of `output` that `pattern` matches, else its first non-blank line, trimmed and cut for a note. */
function noteOf(output: string, pattern: RegExp): string {
  const lines = plain(output).split('\n');
  return (lines[firstMatch(lines, pattern)] ?? '').trim().slice(0, NOTE_MAX);
}

/** The first failing line of a red output, for its criterion's note. */
export const failingLine = (output: string): string => noteOf(output, RED_LINE);
/** The first passing line of a green output, for its criterion's note. */
export const passingLine = (output: string): string => noteOf(output, GREEN_LINE);

type Criterion = { text: string; verdict: 'pass'; note?: string; video?: string; script?: string };

/**
 * The folder's `run.json`: the head `commit`, the issue's `url` and the spec's two criteria, each
 * `pass`, each naming its input (`script` for a `.txt`, `video` for a `.webm`) and, for a text
 * run, noting its first failing or passing line.
 */
export function runJson({
  commit,
  url,
  kind,
  red,
  green,
}: {
  commit: string;
  url: string;
  kind: 'text' | 'clips';
  red: string;
  green: string;
}): { commit: string; url: string; criteria: Criterion[] } {
  if (kind === 'clips') {
    return {
      commit,
      url,
      criteria: [
        { text: RED_CRITERION, verdict: 'pass', video: 'before.webm' },
        { text: GREEN_CRITERION, verdict: 'pass', video: 'after.webm' },
      ],
    };
  }
  const note = (line: string): { note?: string } => (line ? { note: line } : {});
  return {
    commit,
    url,
    criteria: [
      { text: RED_CRITERION, verdict: 'pass', ...note(failingLine(red)), script: 'red.txt' },
      { text: GREEN_CRITERION, verdict: 'pass', ...note(passingLine(green)), script: 'green.txt' },
    ],
  };
}

/** The inputs' names in the run folder: `red.txt` and `green.txt`, or `before.webm` and `after.webm`. */
export function copiedNames(kind: 'text' | 'clips'): [string, string] {
  return kind === 'text' ? ['red.txt', 'green.txt'] : ['before.webm', 'after.webm'];
}
