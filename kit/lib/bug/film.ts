// The before/after GIF of a bug fix and the run folder around it (PRD 1972, `omni bug film`). Two
// outputs of the reproduction (`.txt`, red then green) become two cards; two clips (`.webm`) become
// the two clips, captioned. `filmArgs` is the pure part: the ffmpeg arguments for either case.
// `runJson` is the folder's `run.json`, in the shape `readRun()` accepts.
import { extname } from 'node:path';

/** The lines a card keeps, the width a line is cut to, and how long each card or clip is held. */
const CARD_LINES = 20;
const CARD_WIDTH = 100;
const CARD_SECONDS = 3;
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

/** The text of a card: the output's last `CARD_LINES` lines, each cut to `CARD_WIDTH` characters. */
export function cardText(output: string): string {
  const lines = output.replace(/\r/g, '').replace(/\s+$/, '').split('\n');
  return lines
    .slice(-CARD_LINES)
    .map((line) => line.replace(/\t/g, '  ').slice(0, CARD_WIDTH))
    .join('\n');
}

/** A path or text as ffmpeg's filter syntax reads it inside a single-quoted option value. */
function escapeFilter(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

const PALETTE = 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse';

export type FilmInput =
  | { kind: 'text'; red: string; green: string; out: string }
  | { kind: 'clips'; before: string; after: string; out: string };

/**
 * The ffmpeg arguments that make the GIF. For `text`, `red` and `green` are the files holding each
 * card's text (see `cardText`): each is drawn with `drawtext` over a plain background for
 * `CARD_SECONDS`. For `clips`, each is read up to `CLIP_SECONDS` and captioned. Both end as one
 * `GIF_WIDTH`-wide GIF at `GIF_FPS` frames a second, looping.
 */
export function filmArgs(input: FilmInput): string[] {
  const size = `${GIF_WIDTH}x360`;
  if (input.kind === 'text') {
    const card = (index: number, title: string, file: string): string =>
      `color=c=0x111111:s=${size}:r=${GIF_FPS}:d=${CARD_SECONDS}[bg${index}];` +
      `[bg${index}]drawtext=font=monospace:text='${escapeFilter(title)}':fontcolor=white:fontsize=24:x=16:y=14,` +
      `drawtext=font=monospace:textfile='${escapeFilter(file)}':fontcolor=0xdddddd:fontsize=12:x=16:y=56:line_spacing=4[c${index}]`;
    const graph = `${card(0, RED_TITLE, input.red)};${card(1, GREEN_TITLE, input.green)};[c0][c1]concat=n=2:v=1:a=0,${PALETTE}`;
    return ['-y', '-filter_complex', graph, '-loop', '0', input.out];
  }
  const clip = (index: number, caption: string): string =>
    `[${index}:v]fps=${GIF_FPS},scale=${GIF_WIDTH}:360:force_original_aspect_ratio=decrease,pad=${GIF_WIDTH}:360:(ow-iw)/2:(oh-ih)/2,setsar=1,` +
    `drawtext=font=monospace:text='${escapeFilter(caption)}':fontcolor=white:fontsize=20:box=1:boxcolor=0x000000AA:boxborderw=6:x=12:y=12[c${index}]`;
  const graph = `${clip(0, BEFORE_CAPTION)};${clip(1, AFTER_CAPTION)};[c0][c1]concat=n=2:v=1:a=0,${PALETTE}`;
  return ['-y', '-t', String(CLIP_SECONDS), '-i', input.before, '-t', String(CLIP_SECONDS), '-i', input.after, '-filter_complex', graph, '-loop', '0', input.out];
}

const RED_LINE = /fail|error|exception|assert|✗|✕|red/i;
const GREEN_LINE = /pass|ok\b|✓|✔|green|success/i;
const NOTE_MAX = 200;

/** The first line of `output` that `pattern` matches, else its first non-empty line, cut for a note. */
function noteOf(output: string, pattern: RegExp): string {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const line = lines.find((one) => pattern.test(one)) ?? lines[0] ?? '';
  return line.slice(0, NOTE_MAX);
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
