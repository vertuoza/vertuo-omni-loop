// OMNI DUET's waves (PRD 1633): four chapters written by hand as text, one wave per entry, and the
// check that proves every wave passable. A wave is a few rows of Entropy blocks that enter the
// playfield together from the top and fall at the wave's speed; it is passed once its last block is
// entirely below the circle. The waves sit in one text block so a follow-up tunes them without
// touching the engine, and `waveProblems` keeps every wave passable whatever the tuning.
import { hits, corners, type Block } from './collide';
import { orbs, RULES } from './rules';

/**
 * The legend every wave is written in. A wave's first line is its speed, in game pixels a second,
 * and the gap above it, in game pixels, before it enters: `speed 70` or `speed 70 · gap 32`. Each
 * line after it is one row of ten cells, 16 pixels each, across the middle of the playfield, its
 * first row the top of the wave. A run of the same character in a row is one block.
 *
 *   .   nothing
 *   #   a still block
 *   <   a sliding block, setting off to the left
 *   >   a sliding block, setting off to the right
 *   @   a turning block, anticlockwise
 *   *   a turning block, clockwise
 */
export const LEGEND = Object.freeze({
  '#': { kind: 'still', dir: 1 },
  '<': { kind: 'slide', dir: -1 },
  '>': { kind: 'slide', dir: 1 },
  '@': { kind: 'turn', dir: 1 },
  '*': { kind: 'turn', dir: -1 },
} as const);

/** A wave's geometry: its cells, the thickness of a block in its row, how far a block slides and how fast a block turns. */
export const SHAPE = Object.freeze({
  cell: 16,
  columns: 10,
  /** A block is a bar this thick in its 16-pixel row. */
  thick: 12,
  /** A sliding block moves this far either side of where it was written, at this speed (pixels a second). */
  slideReach: 24,
  slideSpeed: 40,
  /** A turning block turns this many turns a second about its centre. */
  spinTurnsPerSecond: 0.3,
});

/** The left edge of the wave's ten columns: they sit across the middle of the playfield. */
const LEFT = (RULES.field.w - SHAPE.columns * SHAPE.cell) / 2;

export type Kind = (typeof LEGEND)[keyof typeof LEGEND]['kind'];

/** One block as written: its kind, the way it sets off, its row, its first column and its length in cells. */
export interface Piece { kind: Kind; dir: 1 | -1; row: number; col: number; len: number }

export interface Wave { speed: number; gap: number; rows: number; pieces: readonly Piece[] }

export interface Chapter { numeral: string; name: string; waves: readonly Wave[] }

/** Whether a cell's character is one the legend names. */
const inLegend = (ch: string): ch is keyof typeof LEGEND => Object.hasOwn(LEGEND, ch);

const HEADER = /^speed (\d+)(?: · gap (\d+))?$/;

/** Reads one wave's text. `where` names it in a refusal: `chapter II · SLIDE, wave 4`. */
export function parseWave(text: string, where: string): Wave {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  const header = HEADER.exec(lines[0] ?? '');
  if (!header) throw new Error(`${where}: the first line is not "speed <n>" or "speed <n> · gap <n>"`);
  const rows = lines.slice(1);
  if (rows.length === 0) throw new Error(`${where}: no rows`);
  const pieces: Piece[] = [];
  rows.forEach((line, row) => {
    if (line.length !== SHAPE.columns) throw new Error(`${where}, row ${row + 1}: ${line.length} cells, not ${SHAPE.columns}`);
    let col = 0;
    while (col < line.length) {
      const ch = line.charAt(col);
      let len = 1;
      while (line.charAt(col + len) === ch) len++;
      if (ch !== '.') {
        if (!inLegend(ch)) throw new Error(`${where}, row ${row + 1}, column ${col + 1}: "${ch}" is not in the legend`);
        const { kind, dir } = LEGEND[ch];
        pieces.push({ kind, dir, row, col, len });
      }
      col += len;
    }
  });
  return { speed: Number(header[1]), gap: Number(header[2] ?? 0), rows: rows.length, pieces };
}

/** Reads a chapter's waves, each refused with the chapter, the wave and the position of what is wrong. */
export function parseChapter(numeral: string, name: string, texts: readonly string[]): Chapter {
  return { numeral, name, waves: texts.map((t, i) => parseWave(t, `chapter ${numeral} · ${name}, wave ${i + 1}`)) };
}

/** A back-and-forth between -reach and reach, setting off upwards from 0, after `d` pixels travelled. */
function swing(d: number, reach: number): number {
  const p = d % (4 * reach);
  if (p < reach) return p;
  if (p < 3 * reach) return 2 * reach - p;
  return p - 4 * reach;
}

/** The wave's blocks `tick` sub-steps after it began to enter: fallen, slid and turned. */
export function blocksAt(wave: Wave, tick: number): Block[] {
  const t = tick * RULES.subStep;
  const top = -wave.rows * SHAPE.cell - wave.gap + wave.speed * t;
  return wave.pieces.map((p) => {
    const cx = LEFT + (p.col + p.len / 2) * SHAPE.cell + (p.kind === 'slide' ? p.dir * swing(SHAPE.slideSpeed * t, SHAPE.slideReach) : 0);
    const angle = p.kind === 'turn' ? p.dir * Math.PI * 2 * SHAPE.spinTurnsPerSecond * t : 0;
    return { cx, cy: top + (p.row + 0.5) * SHAPE.cell, w: p.len * SHAPE.cell, h: SHAPE.thick, angle };
  });
}

/** The lowest the orbs reach: a block entirely below it can no longer touch them. */
const BELOW = RULES.centre.y + RULES.radius + RULES.orbRadius;

/** Whether every block of the wave has fallen entirely below the circle. */
export function passedAt(wave: Wave, tick: number): boolean {
  return blocksAt(wave, tick).every((b) => corners(b).every((c) => c.y > BELOW));
}

/** Whether a block overlaps either orb with the pair at `angle`. */
export function struck(angle: number, blocks: readonly Block[]): boolean {
  if (blocks.length === 0) return false;
  return orbs(angle).some((o) => blocks.some((b) => hits({ x: o.x, y: o.y, r: RULES.orbRadius }, b)));
}

// ── The passability check ────────────────────────────────────────────────────────────────────────

/**
 * The angles the orbs can stand at, as a ring of `bins` and the bins one sub-step's turn moves them.
 * With 1.75 turns a second and 60 steps a second, a step is 7/240 of a turn: 240 bins, 7 a step, and
 * a run that starts at angle 0 is always on a bin. A tuning with no small whole ring is checked on
 * 720 bins, the step rounded.
 */
export function ring(): { bins: number; move: number } {
  const perStep = RULES.turnsPerSecond * RULES.subStep;
  for (let bins = 1; bins <= 2000; bins++) {
    const move = bins * perStep;
    if (Math.abs(move - Math.round(move)) < 1e-9) return { bins, move: Math.round(move) };
  }
  return { bins: 720, move: Math.max(1, Math.round(720 * perStep)) };
}

/** No wave lasts longer than this: a wave that never passes is named, not waited on forever. */
const LONGEST = 60 / RULES.subStep;

/**
 * The bins the orbs can be at when `wave` is passed, starting from `from`, turning ◀, ▶ or not at
 * each sub-step, never touching a block: empty when no way gets through.
 */
export function through(wave: Wave, from: Uint8Array): { reach: Uint8Array; passed: boolean } {
  const { bins, move } = ring();
  let reach = from;
  for (let tick = 1; tick <= LONGEST; tick++) {
    const blocks = blocksAt(wave, tick).filter((b) => Math.abs(b.cy - RULES.centre.y) <= RULES.radius + RULES.orbRadius + Math.hypot(b.w, b.h) / 2);
    const next = new Uint8Array(bins);
    let any = false;
    for (let b = 0; b < bins; b++) {
      if (!reach[b] && !reach[(b + move) % bins] && !reach[(b - move + bins) % bins]) continue;
      if (struck((b / bins) * Math.PI * 2, blocks)) continue;
      next[b] = 1;
      any = true;
    }
    if (!any) return { reach: next, passed: false };
    reach = next;
    if (passedAt(wave, tick)) return { reach, passed: true };
  }
  return { reach, passed: false };
}

/**
 * One way through `wave` for orbs that stand at `angle` as it begins: the turn of each sub-step (1
 * anticlockwise, ◀; -1 clockwise, ▶; 0 still) until it is passed, or null when there is none. The
 * check's own search, kept: a test plays a run through its waves with it.
 */
export function route(wave: Wave, angle: number): (-1 | 0 | 1)[] | null {
  const { bins, move } = ring();
  const start = ((Math.round((angle / (Math.PI * 2)) * bins) % bins) + bins) % bins;
  // came[t][b]: the bin the orbs stood at the sub-step before, when they stand at `b` after sub-step t + 1; -1 when unreachable.
  const came: Int16Array[] = [];
  let reach = new Uint8Array(bins);
  reach[start] = 1;
  for (let tick = 1; tick <= LONGEST; tick++) {
    const blocks = blocksAt(wave, tick);
    const from = new Int16Array(bins).fill(-1);
    const next = new Uint8Array(bins);
    let any = false;
    for (let b = 0; b < bins; b++) {
      const prev = [b, (b - move + bins) % bins, (b + move) % bins].find((p) => reach[p]);
      if (prev === undefined || struck((b / bins) * Math.PI * 2, blocks)) continue;
      from[b] = prev;
      next[b] = 1;
      any = true;
    }
    if (!any) return null;
    came.push(from);
    reach = next;
    if (passedAt(wave, tick)) {
      let b = reach.indexOf(1);
      const turns: (-1 | 0 | 1)[] = [];
      for (let t = came.length - 1; t >= 0; t--) {
        const p = came[t]?.[b] ?? -1;
        turns.unshift(p === b ? 0 : (p + move) % bins === b ? 1 : -1);
        b = p;
      }
      return turns;
    }
  }
  return null;
}

/**
 * Every wave no way of turning the orbs gets through, named by its chapter and number. Each chapter
 * is checked from every angle (a chapter starts after a ready screen or a banner, where the orbs may
 * stand anywhere), each wave from where the wave before it can leave them.
 */
export function waveProblems(chapters: readonly Chapter[]): string[] {
  const { bins } = ring();
  const problems: string[] = [];
  for (const chapter of chapters) {
    let reach: Uint8Array = new Uint8Array(bins).fill(1);
    chapter.waves.forEach((wave, i) => {
      const out = through(wave, reach);
      if (out.passed) { reach = out.reach; return; }
      problems.push(`chapter ${chapter.numeral} · ${chapter.name}, wave ${i + 1}: no way through`);
      reach = new Uint8Array(bins).fill(1);
    });
  }
  return problems;
}

// ── The chapters ─────────────────────────────────────────────────────────────────────────────────

const DRIFT = [
  `speed 60
   ....##....`,
  `speed 62
   ###.......`,
  `speed 64
   .......###`,
  `speed 66
   ...####...`,
  `speed 68
   ##......##`,
  `speed 70
   .......###
   ..........
   ..........
   ..........
   ###.......`,
  `speed 72 · gap 16
   ####......
   ..........
   ..........
   ..........
   ......####`,
  `speed 76
   ..####....
   ..........
   ..........
   ..........
   ....####..`,
  `speed 80
   ##......##
   ..........
   ..........
   ..........
   ...####...`,
  `speed 84 · gap 16
   ###.......
   ..........
   ..........
   ....##....
   ..........
   ..........
   .......###`,
];

const SLIDE = [
  `speed 70
   ....>>....`,
  `speed 72
   .<<.......`,
  `speed 74
   .......>>.`,
  `speed 76
   ...<<<<...`,
  `speed 78
   >>......<<`,
  `speed 80
   ......>>>.
   ..........
   ..........
   ..........
   .<<<......`,
  `speed 82 · gap 16
   ...####...
   ..........
   ..........
   ..........
   >>......<<`,
  `speed 84
   .<<<......
   ..........
   ..........
   ..........
   ......>>>.`,
  `speed 86
   ....>>....
   ..........
   ..........
   ..........
   ###.......
   ..........
   ..........
   ..........
   .......###`,
  `speed 90 · gap 16
   ..<<<<....
   ..........
   ..........
   ..........
   ....>>>>..`,
];

const SPIN = [
  `speed 70
   ....@@....`,
  `speed 72
   .**.......`,
  `speed 74
   .......@@.`,
  `speed 76
   ...***....`,
  `speed 78
   @@......**`,
  `speed 80
   .......@@.
   ..........
   ..........
   ..........
   .**.......`,
  `speed 82 · gap 16
   ....@@....
   ..........
   ..........
   ..........
   ##......##`,
  `speed 84
   ..>>......
   ..........
   ..........
   ..........
   ......**..`,
  `speed 88
   ...@@@....
   ..........
   ..........
   ..........
   ..........
   ....***...`,
  `speed 92 · gap 16
   ###.......
   ..........
   ..........
   ....@@....
   ..........
   ..........
   .......###`,
];

const STORM = [
  `speed 96
   ....##....`,
  `speed 98
   .>>.......`,
  `speed 100
   .......@@.`,
  `speed 102
   ##......**`,
  `speed 104
   ...<<<<...`,
  `speed 106
   .......###
   ..........
   ..........
   ..........
   ..........
   .@@.......`,
  `speed 108 · gap 16
   ....>>....
   ..........
   ..........
   ..........
   ..........
   ##......##`,
  `speed 110
   .**.......
   ..........
   ..........
   ..........
   ..........
   ......<<<.`,
  `speed 114
   ...@@@....
   ..........
   ..........
   ..........
   ..........
   ..........
   ###.....##`,
  `speed 118 · gap 16
   ..>>......
   ..........
   ..........
   ..........
   ..........
   ....**....
   ..........
   ..........
   ..........
   ..........
   ......<<..`,
];

/** The four chapters, in the order they are played. */
export const CHAPTERS: readonly Chapter[] = Object.freeze([
  parseChapter('I', 'DRIFT', DRIFT),
  parseChapter('II', 'SLIDE', SLIDE),
  parseChapter('III', 'SPIN', SPIN),
  parseChapter('IV', 'STORM', STORM),
]);
