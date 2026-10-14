// Tests only (PRD 1923): a circuit whose line crosses itself, a figure eight on 72×72 tiles, to try the engine's branch on, before any circuit of the game does.
// Its eight waypoints are those FROST EIGHT is specified with; it has no relief, boxes or scenery of its own.
import { PLACES, type TrackSource } from './track';

const SIZE = 72;
/** The start line: a column across the bottom straight at x = 32, the road 5 tiles wide around y = 64. */
const START_X = 32;

const rows = (): string[] => {
  const grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => '.'));
  const put = (x: number, y: number, c: string) => { const row = grid[y]; if (row) row[x] = c; };
  for (let y = 62; y <= 66; y++) put(START_X, y, '=');
  for (let i = 0; i < PLACES; i++) put(START_X - 2 - 2 * Math.floor(i / 2), 63 + 2 * (i % 2), 'S');
  return grid.map((r) => r.join(''));
};

/** The figure eight: the two diagonals cross at the middle of the map, at about 62 degrees. */
export const EIGHT: TrackSource = {
  rows: rows(),
  waypoints: [[56, 64, 5], [56, 48, 4], [16, 24, 4], [16, 8, 5], [56, 8, 5], [56, 24, 4], [16, 48, 4], [16, 64, 5]],
  width: 5,
};

/** `EIGHT` with a source field changed. */
export const eightWith = (change: Partial<TrackSource>): TrackSource => ({ ...EIGHT, ...change });
