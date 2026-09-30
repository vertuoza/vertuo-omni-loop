// Super Omni World's stages (PRD 817), as text: one character per 16px tile, 18 rows high (the tall
// grid's height), up to 220 tiles long, played left to right. A pit is a column with nothing solid
// on the bottom row. `stageProblems` holds each stage to the checks that make it playable, and
// stages.test.ts runs them on every stage here.
import { longestPit } from './rules';

/**
 * The legend, for every map below:
 *
 *   .  empty          #  ground         B  brick          ?  ? block
 *   P  pipe           C  castle stone   o  coin           e  enemy
 *   S  the start      F  the flag
 *
 * The start, the flag, the coins and the enemies stand on empty tiles: S is where the hero's feet
 * stand, on the tile above the ground, and F is the foot of the flag's pole.
 */
export const LEGEND = Object.freeze({
  '.': 'empty', '#': 'ground', B: 'brick', '?': 'block', P: 'pipe', C: 'stone',
  o: 'coin', e: 'enemy', S: 'start', F: 'flag',
} as const);

type Mark = (typeof LEGEND)[keyof typeof LEGEND];
/** What a tile is made of: the places (start, flag, coins, enemies) sit on empty ones. */
export type Tile = Extract<Mark, 'empty' | 'ground' | 'brick' | 'block' | 'pipe' | 'stone'>;

/** The tiles a body stands on and bumps into. */
export const SOLID: ReadonlySet<Tile> = new Set<Tile>(['ground', 'brick', 'block', 'pipe', 'stone']);

export const STAGE_ROWS = 18;
export const MAX_COLS = 220;

export interface Cell { col: number; row: number }

export interface Stage {
  id: string;
  /** Its palette in @omni/design's STAGE_PALETTES. */
  palette: string;
  rows: number;
  /** The first row's length: every row must match it. */
  cols: number;
  /** Each row's length, as written. */
  widths: number[];
  /** Row by row, then column by column. */
  tiles: Tile[][];
  starts: Cell[];
  flags: Cell[];
  coins: Cell[];
  enemies: Cell[];
}

/** A map with a character the legend does not know, named with its row and column (from 1). */
export class StageError extends Error {
  constructor(readonly stage: string, readonly char: string, readonly row: number, readonly col: number) {
    super(`stage ${stage}: unknown tile "${char}" at row ${row}, column ${col}`);
    this.name = 'StageError';
  }
}

const isMark = (c: string): c is keyof typeof LEGEND => Object.hasOwn(LEGEND, c);

/** Reads a map, row by row. Throws a StageError on a character the legend does not know. */
export function parseStage(id: string, palette: string, text: string): Stage {
  const lines = text.split('\n');
  const stage: Stage = {
    id, palette, rows: lines.length, cols: lines[0]?.length ?? 0, widths: lines.map((l) => l.length),
    tiles: [], starts: [], flags: [], coins: [], enemies: [],
  };
  const places = { start: stage.starts, flag: stage.flags, coin: stage.coins, enemy: stage.enemies } as const;
  lines.forEach((line, row) => {
    stage.tiles.push([...line].map((c, col) => {
      if (!isMark(c)) throw new StageError(id, c, row + 1, col + 1);
      const mark = LEGEND[c];
      if (mark in places) { places[mark as keyof typeof places].push({ col, row }); return 'empty'; }
      return mark as Tile;
    }));
  });
  return stage;
}

/** Each pit: a run of columns with nothing solid on the bottom row, from its first column (from 0). */
export function pits(stage: Stage): { col: number; width: number }[] {
  const bottom = stage.tiles[stage.rows - 1] ?? [];
  const found: { col: number; width: number }[] = [];
  bottom.forEach((t, col) => {
    if (SOLID.has(t)) return;
    const last = found[found.length - 1];
    if (last && last.col + last.width === col) last.width += 1;
    else found.push({ col, width: 1 });
  });
  return found;
}

const count = (n: number, one: string, many: string) => (n === 0 ? `no ${one}` : `${n} ${many}`);

/** What keeps a stage from being played, in words; none for a stage that passes every check. */
export function stageProblems(stage: Stage): string[] {
  const problems: string[] = [];
  if (stage.starts.length !== 1) problems.push(count(stage.starts.length, 'start', 'starts'));
  if (stage.flags.length !== 1) problems.push(count(stage.flags.length, 'flag', 'flags'));
  if (stage.rows !== STAGE_ROWS) problems.push(`${stage.rows} rows, not ${STAGE_ROWS}`);
  stage.widths.forEach((w, i) => { if (w !== stage.cols) problems.push(`row ${i + 1} is ${w} tiles long, not ${stage.cols}`); });
  if (stage.cols > MAX_COLS) problems.push(`${stage.cols} tiles long, more than ${MAX_COLS}`);
  const [start] = stage.starts;
  if (start && stage.starts.length === 1 && !SOLID.has(stage.tiles[start.row + 1]?.[start.col] ?? 'empty')) problems.push('no ground under the start');
  for (const e of stage.enemies) {
    if (!SOLID.has(stage.tiles[e.row + 1]?.[e.col] ?? 'empty')) problems.push(`enemy at row ${e.row + 1}, column ${e.col + 1} stands on nothing`);
  }
  const reach = longestPit();
  for (const p of pits(stage)) {
    if (p.width > reach) problems.push(`pit at column ${p.col + 1} is ${p.width} tiles wide, more than a run-jump (${reach})`);
  }
  return problems;
}

// ── The stages ──

// 1-1, grass: bricks and ? blocks to jump into, three pipes growing taller with a blob between two
// of them, three pits with an arc of coins over each, two staircases and the last climb to the flag.
const STAGE_1_1 = [
  '....................................................................................................................................',
  '....................................................................................................................................',
  '....................................................................................................................................',
  '....................................................................................................................................',
  '....................................................................................................................................',
  '....................................................................................................................................',
  '.....................................................................oooooo.........................................................',
  '......................?.............................................BBB?BB..........................................................',
  '....................................................................................................................................',
  '....................ooooo...........................................................................................................',
  '...................................................................................................................##...............',
  '................?...B?B?B................................oo....B?B..........ooo.......................oooo........###...............',
  '..................................ooo.............PP....o..o...............o...o...........#..#..................####...............',
  '........................................PP........PP......................................##..##................#####...............',
  '..............................PP........PP........PP.....................................###..###..............######...............',
  '...S....................e.....PP........PP...e....PP............e.....e...........e.....####..####.e..........#######.e.....F.......',
  '#########################################################..#################...########################..###########################',
  '#########################################################..#################...########################..###########################',
].join('\n');

// 1-2, underground: a brick ceiling over the whole stage but its entry, brick ledges to climb and
// a high one to run along, pipes around the pits, walls to hop with a blob between them, and a
// brick staircase up to the way out.
const STAGE_1_2 = [
  '......BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  '......BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  '......................................................................................................................................................',
  '......................................................................................................................................................',
  '......................................................................................................................................................',
  '......................................................................................................................................................',
  '......................................................................................................................................................',
  '..................................................ooooo......................................ooo......................................................',
  '.................................................BBBBBBB..............................................................................................',
  '......................................................................................................................................................',
  '............o.o.o...............................................................................................ooooo.................................',
  '............?B?B?............ooooo.......oooooo...........oooo..............ooo.............B?B?B...................................BBB...............',
  '...................................PP...BBBBBBBB....?...........................BB.................................................BBBB...............',
  '..........................PP.......PP.....................................BB....BB........................PP......................BBBBB...............',
  '..........................PP.......PP.....................................BB....BB........................PP..........PP.........BBBBBB...............',
  '...S..............e.....e.PP.......PP.......e........e.............e...e..BB..e.BB................e....e..PP..........PP....e...BBBBBBB........F......',
  '##############################...#########################....##########################...#####################.....#################################',
  '##############################...#########################....##########################...#####################.....#################################',
].join('\n');

// 1-3, the castle: stone underfoot and overhead, stone steps either side of the pits, pillars
// hanging from the ceiling to pass under, two pits a single stone block apart, and the keep's stair
// with a blob on its top floor before the flag.
const STAGE_1_3 = [
  'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  '........................................CC..........................................................................CC..........................................',
  '........................................CC..........................................................................CC..........................................',
  '........................................CC..........................................................................CC..........................................',
  '........................................CC..........................................................................CC..........................................',
  '........................................CC..........................................................................CC..........................................',
  '........................................CC..........................................................................CC..........................................',
  '........................................CC............................ooooo.........................................CC..........................................',
  '........................................CC..........................................................................CC...........ooooo..........................',
  '..........?.?.?......oooo...............CC....oooo......B?B.........................?C?............ooooo.......................................e................',
  '......................................oooooo................................CC.............................................................CCCCCCC..............',
  '................................................................CC..........CC..............................................CCCC..........CCCCCCCC..............',
  '...................CCC...CCC....................................CC..........CC.....................CCCCC....................CCCC.........CCCCCCCCC..............',
  '...S............e..CCC...CCC....e...e..................e....e...CC..........CC....e...e...e........CCCCC........e.......e...CCCC........CCCCCCCCCC......F.......',
  'CCCCCCCCCCCCCCCCCCCCCC...CCCCCCCCCCCCCCCCCCCCC....CCCCCCCCCCCCCCCCCCCC.....CCCCCCCCCCCCCCCCCCCCC...CCCCC...CCCCCCCCCCCCCCCCCCCCC.....CCCCCCCCCCCCCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCCCCCCCC...CCCCCCCCCCCCCCCCCCCCC....CCCCCCCCCCCCCCCCCCCC.....CCCCCCCCCCCCCCCCCCCCC...CCCCC...CCCCCCCCCCCCCCCCCCCCC.....CCCCCCCCCCCCCCCCCCCCCCCCCCC',
].join('\n');

/** Every stage, in the order they are played (the rules' WORLD), each in its own palette. */
export const STAGES: readonly Stage[] = [
  parseStage('1-1', 'grass', STAGE_1_1),
  parseStage('1-2', 'underground', STAGE_1_2),
  parseStage('1-3', 'castle', STAGE_1_3),
];
