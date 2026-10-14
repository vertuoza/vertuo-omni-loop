// Tests only (PRD 1923): a circuit whose line crosses itself, a figure eight on 72×72 tiles, to try the engine's branch on, before any circuit of the game does.
// Its eight waypoints are those FROST EIGHT is specified with; it has no relief, boxes or scenery of its own.
import { FLOOR, PLACES, TILE, roadAt, type Ground, type TrackSource } from './track';

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

/** `g` with a floor (PRD 1923): ice in the disc of 6 tiles' radius at the middle of the map, road where the road is, powder everywhere else, no void: what FROST EIGHT will be. */
export function withFloor<G extends Ground>(g: G): G {
  const floor = new Uint8Array(g.size.w * g.size.h);
  const mid = [g.size.w / 2, g.size.h / 2] as const;
  for (let y = 0; y < g.size.h; y++) {
    for (let x = 0; x < g.size.w; x++) {
      const lake = Math.hypot(x + 0.5 - mid[0], y + 0.5 - mid[1]) < 6 * TILE;
      floor[y * g.size.w + x] = lake ? FLOOR.ice : roadAt(g, x, y) ? FLOOR.road : FLOOR.powder;
    }
  }
  return { ...g, floor };
}
