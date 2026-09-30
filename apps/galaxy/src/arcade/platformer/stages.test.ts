import { describe, expect, it } from 'vitest';
import { longestPit } from './rules';
import { LEGEND, MAX_COLS, parseStage, pits, SOLID, STAGE_ROWS, stageProblems, STAGES, StageError } from './stages';

// Super Omni World's stages as data (PRD 817): each one a text map, checked here so a stage that
// cannot be played never ships.

/** A stage of `rows` rows, each `line` unless `at` gives that row its own. */
const map = (line: string, at: Record<number, string> = {}, rows = STAGE_ROWS) =>
  Array.from({ length: rows }, (_, i) => at[i] ?? line).join('\n');
const FLOOR = '##########';
const good = (over: Record<number, string> = {}) => map('..........', { 15: '.S......F.', 16: FLOOR, 17: FLOOR, ...over });

describe('every stage', () => {
  it('starts with 1-1, in the grass palette', () => {
    expect(STAGES.map((s) => [s.id, s.palette])[0]).toEqual(['1-1', 'grass']);
  });

  it.each(STAGES.map((s) => [s.id, s] as const))('%s passes the stage checks', (_, stage) => {
    expect(stageProblems(stage)).toEqual([]);
  });

  it.each(STAGES.map((s) => [s.id, s] as const))('%s has one start, one flag, 18 equal rows, ground under the start, and fits the length cap', (_, stage) => {
    expect(stage.starts).toHaveLength(1);
    expect(stage.flags).toHaveLength(1);
    expect(stage.rows).toBe(18);
    expect(new Set(stage.widths)).toEqual(new Set([stage.cols]));
    expect(stage.cols).toBeLessThanOrEqual(MAX_COLS);
    const [start] = stage.starts;
    expect(stage.tiles[start.row + 1][start.col]).toBe('ground');
  });

  it.each(STAGES.map((s) => [s.id, s] as const))('%s has pits, none wider than a run-jump', (_, stage) => {
    expect(pits(stage).length).toBeGreaterThan(0);
    for (const p of pits(stage)) expect(p.width, `pit at column ${p.col}`).toBeLessThanOrEqual(longestPit());
  });

  it('1-1 has ground, bricks, ? blocks and pipes to play on', () => {
    const tiles = new Set(STAGES[0].tiles.flat());
    for (const t of ['ground', 'brick', 'block', 'pipe'] as const) expect(tiles, t).toContain(t);
  });

  it('1-1 has coins to take and Entropy blobs to stomp, every blob standing on something solid', () => {
    const [s] = STAGES;
    expect(s.coins.length).toBeGreaterThanOrEqual(10);
    expect(s.enemies.length).toBeGreaterThanOrEqual(5);
    for (const e of s.enemies) expect(SOLID.has(s.tiles[e.row + 1][e.col]), `blob at column ${e.col + 1}`).toBe(true);
  });
});

describe('parseStage', () => {
  it('reads each legend character as its tile, and the start, the flag, the coins and the enemies as places on empty ground', () => {
    const s = parseStage('t', 'grass', good({ 14: '..?B.PC.oe' }));
    expect(s.tiles[14]).toEqual(['empty', 'empty', 'block', 'brick', 'empty', 'pipe', 'stone', 'empty', 'empty', 'empty']);
    expect(s.starts).toEqual([{ col: 1, row: 15 }]);
    expect(s.flags).toEqual([{ col: 8, row: 15 }]);
    expect(s.coins).toEqual([{ col: 8, row: 14 }]);
    expect(s.enemies).toEqual([{ col: 9, row: 14 }]);
    expect(s.tiles[15][1]).toBe('empty');
  });

  it('writes the whole legend above the maps', () => {
    expect(Object.keys(LEGEND).sort()).toEqual(['#', '.', '?', 'B', 'C', 'F', 'P', 'S', 'e', 'o'].sort());
  });

  it('refuses an unknown character, naming it with its row and column', () => {
    const text = good({ 3: '....x.....' });
    expect(() => parseStage('t', 'grass', text)).toThrow(StageError);
    expect(() => parseStage('t', 'grass', text)).toThrow('stage t: unknown tile "x" at row 4, column 5');
  });
});

describe('stageProblems', () => {
  it('passes a well-formed stage', () => {
    expect(stageProblems(parseStage('t', 'grass', good()))).toEqual([]);
  });

  it('names a missing or second start and flag', () => {
    expect(stageProblems(parseStage('t', 'grass', good({ 15: '..........' })))).toEqual(['no start', 'no flag']);
    expect(stageProblems(parseStage('t', 'grass', good({ 15: '.S.S..F.F.' })))).toEqual(['2 starts', '2 flags']);
  });

  it('names a stage that is not 18 rows high, or whose rows differ in length', () => {
    expect(stageProblems(parseStage('t', 'grass', map('..........', { 14: '.S......F.', 15: FLOOR, 16: FLOOR }, 17)))).toContain('17 rows, not 18');
    expect(stageProblems(parseStage('t', 'grass', good({ 4: '...' })))).toContain('row 5 is 3 tiles long, not 10');
  });

  it('names a start with no ground under it', () => {
    expect(stageProblems(parseStage('t', 'grass', good({ 16: '#.########', 17: '#.########' })))).toContain('no ground under the start');
  });

  it('names an enemy with nothing solid under it', () => {
    expect(stageProblems(parseStage('t', 'grass', good({ 14: '....e.....', 15: '.S..e...F.' })))).toEqual(['enemy at row 15, column 5 stands on nothing']);
  });

  it('names a pit wider than a run-jump, and lets one as wide pass', () => {
    const cols = longestPit() + 12;
    const floor = (gap: number) => `${'#'.repeat(4)}${'.'.repeat(gap)}${'#'.repeat(cols - 4 - gap)}`;
    const stage = (gap: number) => parseStage('t', 'grass', map('.'.repeat(cols), { 15: `.S${'.'.repeat(cols - 4)}F.`, 16: floor(gap), 17: floor(gap) }));
    expect(stageProblems(stage(longestPit()))).toEqual([]);
    expect(stageProblems(stage(longestPit() + 1))).toEqual([`pit at column 5 is ${longestPit() + 1} tiles wide, more than a run-jump (${longestPit()})`]);
  });

  it('names a stage longer than the cap', () => {
    const line = '.'.repeat(MAX_COLS + 1);
    const floor = '#'.repeat(MAX_COLS + 1);
    const text = map(line, { 15: `.S${'.'.repeat(MAX_COLS - 3)}F.`, 16: floor, 17: floor });
    expect(stageProblems(parseStage('t', 'grass', text))).toEqual([`${MAX_COLS + 1} tiles long, more than ${MAX_COLS}`]);
  });
});
