// COMET RING, OMNI KART's one circuit (PRD 1359): a text map, one character per 16px tile, with the
// racing line beside it. The map, the legend and the checks live here, pure, so the circuit is proved
// drivable before anything is drawn. Rows and columns in every message count from 0, the way the
// waypoints' x and y do.
//
// The legend:
//   #  road          .  grass (halves the top speed)       X  wall (bounces a kart off)
//   r  kerb (road)   =  the start line (road)               ?  an item box (road)
//   S  a starting place (road)
// Props (PRD 1427) are not in the map: they are listed beside it, each a kind and a wall tile.
import { at, defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';

/** A tile's side in game pixels: the circuit's texture is one tile = 16×16 pixels. */
export const TILE = 16;
/** The laps a race runs. */
export const LAPS = 3;
/** The karts on the grid: the player and five rivals. */
export const PLACES = 6;

const LEGEND = Object.freeze({
  '#': 'road', '.': 'grass', X: 'wall', r: 'kerb', '=': 'line', '?': 'box', S: 'start',
} as const);
type TileChar = keyof typeof LEGEND;

const isTileChar = (c: string): c is TileChar => Object.hasOwn(LEGEND, c);

/** A circuit as written: its map's rows, and the racing line's waypoints as tile coordinates [x, y], in driving order. */
export interface TrackSource {
  readonly rows: readonly string[];
  readonly waypoints: readonly (readonly [number, number])[];
  /** What stands on the wall tiles around the circuit; none when left out. */
  readonly props?: readonly Prop[];
}

/** What stands off the road: pylons and beacons along the circuit's edge, the rest deeper in. */
export const PROP_KINDS = ['pylon', 'beacon', 'asteroid', 'satellite', 'wreck'] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/** A prop as written: its kind and the tile it stands on. */
export interface Prop { readonly kind: PropKind; readonly x: number; readonly y: number }

// 64×64 tiles. The road is five tiles wide. The racing line starts at the first corner after the line
// (the long start straight runs along the bottom, east), and its last waypoint is the corner before it.
const COMET_RING_ROWS = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXX.....................XXXXXXX.............................XXX',
  'XXXX.....................XXXXXXX.............................XXX',
  'XXXX..r#r#r#######r#r#r..XXXXXXX..r#r#r###############r#r#r..XXX',
  'XXXX..#################..XXXXXXX..#########################..XXX',
  'XXXX..r###############r..XXXXXXX..r#######################r..XXX',
  'XXXX..#################..XXXXXXX..#########################..XXX',
  'XXXX..r###############r..XXXXXXX..r#######################r..XXX',
  'XXXX..#####.......#####..XXXXXXX..#####...............#####..XXX',
  'XXXX..#####.......#####..XXXXXXX..#####...............#####..XXX',
  'XXXX..#####..XXX..#####..XXXXXXX..#####..XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX..#####..XXXXXXX..#####..XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX..#####..XXXXXXX..#####..XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX..#####...........#####..XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX..#####...........#####..XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX..r###################r..XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX..#####################..XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX..r###################r..XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX..#####################..XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX..r#r#r###########r#r#r..XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX.........................XXXXXXXXXXX..#####..XXX',
  'XXXX..#####..XXX......................................#####..XXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..............#####..XXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..r#r#r###########r..XXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#################..XXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..r###############r..XXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#################..XXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..r###########r#r#r..XXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..............XXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..............XXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..XXXXXXXXXXXXXXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..XXXXXXXXXXXXXXX',
  'XXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..XXXXXXXXXXXXXXX',
  'XXXX..#####............XXXXXXXXXXXXXXXXX..#####............XXXXX',
  'XXXX..#####............XXXXXXXXXXXXXXXXX..#####............XXXXX',
  'XXXX..r#########r#r#r..XXXXXXXXXXXXXXXXX..r#########r#r#r..XXXXX',
  'XXXX..###############..XXXXXXXXXXXXXXXXX..###############..XXXXX',
  'XXXX..r#############r..XXXXXXXXXXXXXXXXX..r#############r..XXXXX',
  'XXXX..###############..XXXXXXXXXXXXXXXXX..###############..XXXXX',
  'XXXX..r#r#r#########r..XXXXXXXXXXXXXXXXX..r#r#r#########r..XXXXX',
  'XXXX............#####..XXXXXXXXXXXXXXXXX............#####..XXXXX',
  'XXXX............#####..XXXXXXXXXXXXXXXXX............#####..XXXXX',
  'XXXXXXXXXXXXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..XXXXX',
  'XXXXXXXXXXXXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..XXXXX',
  'XXXXXXXXXXXXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..XXXXX',
  'XXXXXXXXXXXXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..XXXXX',
  'XXXXXXXXXXXXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..XXXXX',
  'XXXXXXXXXXXXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..XXXXX',
  'XXXXXXXXXXXXXX..#####..XXXXXXXXXXXXXXXXXXXXXXXXXXX..#####..XXXXX',
  'XXXXXXXXXXXXXX..#####...............................#####..XXXXX',
  'XXXXXXXXXXXXXX..#####...............................#####..XXXXX',
  'XXXXXXXXXXXXXX..r########S##S#=#########?###?###########r..XXXXX',
  'XXXXXXXXXXXXXX..##############=#########?###?############..XXXXX',
  'XXXXXXXXXXXXXX..r########S##S#=#########################r..XXXXX',
  'XXXXXXXXXXXXXX..##############=#########?###?############..XXXXX',
  'XXXXXXXXXXXXXX..r#r#r####S##S#=#########?###?#######r#r#r..XXXXX',
  'XXXXXXXXXXXXXX.............................................XXXXX',
  'XXXXXXXXXXXXXX.............................................XXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
] as const;

export const COMET_RING: TrackSource = {
  rows: COMET_RING_ROWS,
  waypoints: [
    [54, 56], [54, 40], [44, 40], [44, 28], [56, 28], [56, 8], [36, 8],
    [36, 20], [20, 20], [20, 8], [8, 8], [8, 40], [18, 40], [18, 56],
  ],
  // Pylons and beacons alternate along the wall tiles that touch the verge; asteroids, satellites and
  // wrecks stand on wall tiles with no verge within three tiles. Every one is on a wall tile.
  props: [
    { kind: 'pylon', x: 4, y: 3 }, { kind: 'beacon', x: 11, y: 3 }, { kind: 'pylon', x: 18, y: 3 },
    { kind: 'beacon', x: 32, y: 3 }, { kind: 'pylon', x: 39, y: 3 }, { kind: 'beacon', x: 46, y: 3 },
    { kind: 'pylon', x: 53, y: 3 }, { kind: 'beacon', x: 60, y: 3 }, { kind: 'pylon', x: 25, y: 4 },
    { kind: 'beacon', x: 3, y: 10 }, { kind: 'pylon', x: 31, y: 10 }, { kind: 'beacon', x: 61, y: 10 },
    { kind: 'pylon', x: 13, y: 13 }, { kind: 'beacon', x: 41, y: 13 }, { kind: 'pylon', x: 48, y: 13 },
    { kind: 'beacon', x: 25, y: 14 }, { kind: 'pylon', x: 3, y: 17 }, { kind: 'beacon', x: 61, y: 17 },
    { kind: 'pylon', x: 13, y: 20 }, { kind: 'beacon', x: 41, y: 20 }, { kind: 'pylon', x: 51, y: 20 },
    { kind: 'beacon', x: 3, y: 24 }, { kind: 'pylon', x: 61, y: 24 }, { kind: 'beacon', x: 18, y: 25 },
    { kind: 'pylon', x: 25, y: 25 }, { kind: 'beacon', x: 32, y: 25 }, { kind: 'pylon', x: 39, y: 27 },
    { kind: 'beacon', x: 13, y: 30 }, { kind: 'pylon', x: 3, y: 31 }, { kind: 'beacon', x: 61, y: 31 },
    { kind: 'pylon', x: 49, y: 33 }, { kind: 'beacon', x: 39, y: 34 }, { kind: 'pylon', x: 18, y: 35 },
    { kind: 'beacon', x: 3, y: 38 }, { kind: 'pylon', x: 59, y: 38 }, { kind: 'beacon', x: 23, y: 40 },
    { kind: 'pylon', x: 39, y: 41 }, { kind: 'beacon', x: 4, y: 45 }, { kind: 'pylon', x: 11, y: 45 },
    { kind: 'beacon', x: 45, y: 45 }, { kind: 'pylon', x: 59, y: 45 }, { kind: 'beacon', x: 23, y: 47 },
    { kind: 'pylon', x: 29, y: 51 }, { kind: 'beacon', x: 36, y: 51 }, { kind: 'pylon', x: 49, y: 51 },
    { kind: 'beacon', x: 13, y: 52 }, { kind: 'pylon', x: 59, y: 52 }, { kind: 'beacon', x: 13, y: 59 },
    { kind: 'pylon', x: 59, y: 59 }, { kind: 'beacon', x: 20, y: 61 }, { kind: 'pylon', x: 27, y: 61 },
    { kind: 'beacon', x: 34, y: 61 }, { kind: 'pylon', x: 41, y: 61 }, { kind: 'beacon', x: 48, y: 61 },
    { kind: 'asteroid', x: 28, y: 1 }, { kind: 'satellite', x: 28, y: 11 }, { kind: 'wreck', x: 44, y: 16 },
    { kind: 'asteroid', x: 16, y: 28 }, { kind: 'satellite', x: 26, y: 28 }, { kind: 'wreck', x: 36, y: 28 },
    { kind: 'asteroid', x: 62, y: 36 }, { kind: 'satellite', x: 31, y: 37 }, { kind: 'wreck', x: 26, y: 46 },
    { kind: 'asteroid', x: 36, y: 46 }, { kind: 'satellite', x: 62, y: 46 }, { kind: 'wreck', x: 1, y: 48 },
    { kind: 'asteroid', x: 46, y: 48 }, { kind: 'satellite', x: 10, y: 53 }, { kind: 'wreck', x: 62, y: 56 },
    { kind: 'asteroid', x: 1, y: 58 },
  ],
};

/** A tile that is road under the wheels: the road, a kerb, the line, a box or a starting place. */
export const isRoad = (c: string): boolean => c === '#' || c === 'r' || c === '=' || c === '?' || c === 'S';

/** The tile at column x, row y; a wall past the map's edge. */
export function tileAt(rows: readonly string[], x: number, y: number): string {
  return rows[y]?.[x] ?? 'X';
}

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Whether the tile at x, y has at least three road tiles among its four neighbours: it stands on the road, not beside it. */
function onRoad(rows: readonly string[], x: number, y: number): boolean {
  return NEIGHBOURS.filter(([dx, dy]) => isRoad(tileAt(rows, x + dx, y + dy))).length >= 3;
}

/** The tiles a straight walk from a to b crosses, a and b included (Bresenham). */
function walk(a: readonly [number, number], b: readonly [number, number]): [number, number][] {
  const out: [number, number][] = [];
  let [x, y] = a;
  const [x1, y1] = b;
  const dx = Math.abs(x1 - x), dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1, sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

const where = (x: number, y: number) => `row ${y}, col ${x}`;

/** The tiles of one character, as [x, y] in reading order. */
function tilesOf(rows: readonly string[], c: string): [number, number][] {
  const out: [number, number][] = [];
  rows.forEach((row, y) => { Array.from(row).forEach((t, x) => { if (t === c) out.push([x, y]); }); });
  return out;
}

/** The start line: its tiles, and which way is forward: the unit step from the line towards the first waypoint, on the axis the line is not along. */
interface StartLine { tiles: [number, number][]; axis: 'column' | 'row'; forward: readonly [number, number] }

function lineOf(src: TrackSource): StartLine | null {
  const tiles = tilesOf(src.rows, '=');
  const [first] = tiles;
  const w0 = src.waypoints[0];
  if (!first || !w0) return null;
  const axis = tiles.every(([x]) => x === first[0]) ? 'column' : tiles.every(([, y]) => y === first[1]) ? 'row' : null;
  if (!axis) return null;
  const side = axis === 'column' ? Math.sign(w0[0] - first[0]) : Math.sign(w0[1] - first[1]);
  return { tiles, axis, forward: axis === 'column' ? [side, 0] : [0, side] };
}

/**
 * What is wrong with a circuit, each problem with the row and the column it is at: an unknown
 * character, rows of unequal length, a waypoint off the road, two consecutive waypoints (the last and
 * the first too) not joined by road, not exactly six starting places behind the line, a start line
 * that does not cross the road from wall to wall, an item box off the road, a prop off a wall tile.
 * Empty when it is drivable.
 */
export function trackProblems(src: TrackSource = COMET_RING): string[] {
  const shape = shapeProblems(src.rows);
  if (shape.length) return shape;
  return [...waypointProblems(src), ...placeProblems(src.rows), ...lineProblems(src), ...boxProblems(src.rows), ...propProblems(src)];
}

/** An unknown character, or a row not as long as the first. */
function shapeProblems(rows: readonly string[]): string[] {
  const problems: string[] = [];
  const width = rows[0]?.length ?? 0;
  rows.forEach((row, y) => {
    if (row.length !== width) problems.push(`${where(row.length, y)}: this row is ${row.length} tiles long, the first is ${width}`);
    Array.from(row).forEach((c, x) => { if (!isTileChar(c)) problems.push(`${where(x, y)}: unknown character '${c}'`); });
  });
  return problems;
}

/** A waypoint off the road, or two consecutive waypoints (the last and the first too) not joined by road. */
function waypointProblems({ rows, waypoints }: TrackSource): string[] {
  const problems: string[] = [];
  waypoints.forEach(([x, y], i) => {
    if (!isRoad(tileAt(rows, x, y))) problems.push(`${where(x, y)}: waypoint ${i} is off the road`);
  });
  waypoints.forEach((a, i) => {
    const j = (i + 1) % waypoints.length;
    const b = at(waypoints, j, 'the next waypoint');
    const off = walk(a, b).find(([x, y]) => !isRoad(tileAt(rows, x, y)));
    if (off) problems.push(`${where(off[0], off[1])}: waypoints ${i} and ${j} are not joined by road`);
  });
  return problems;
}

/** Not exactly six starting places, or one off the road. */
function placeProblems(rows: readonly string[]): string[] {
  const problems: string[] = [];
  const places = tilesOf(rows, 'S');
  if (places.length !== PLACES) {
    const [x, y] = places[PLACES] ?? places[places.length - 1] ?? [0, 0];
    problems.push(`${where(x, y)}: ${PLACES} starting places expected, ${places.length} found`);
  }
  for (const [x, y] of places) if (!onRoad(rows, x, y)) problems.push(`${where(x, y)}: starting place off the road`);
  return problems;
}

/** A start line that is missing, crooked, gapped, not crossing the road from wall to wall, or with a starting place not behind it. */
function lineProblems(src: TrackSource): string[] {
  const line = lineOf(src);
  if (!line) {
    const lineStart = tilesOf(src.rows, '=')[0];
    const [x, y] = lineStart ?? [0, 0];
    return [`${where(x, y)}: ${lineStart ? 'the start line is not one straight run' : 'no start line'}`];
  }
  return [...lineShapeProblems(src.rows, line), ...lineBehindProblems(src.rows, line)];
}

/** The line's tiles in order along it, the coordinate `k` it runs along (1 for a column), and its two ends. */
function lineEnds(line: StartLine) {
  const k: 0 | 1 = line.axis === 'column' ? 1 : 0;
  const ordered = [...line.tiles].sort((a, b) => a[k] - b[k]);
  return { k, ordered, first: at(ordered, 0, 'the first tile of the line'), last: at(ordered, ordered.length - 1, 'the last tile of the line') };
}

/** A start line with a gap, or one that does not cross the road from wall to wall. */
function lineShapeProblems(rows: readonly string[], line: StartLine): string[] {
  const problems: string[] = [];
  const { k, ordered, first, last } = lineEnds(line);
  const before: [number, number] = line.axis === 'column' ? [first[0], first[1] - 1] : [first[0] - 1, first[1]];
  const after: [number, number] = line.axis === 'column' ? [last[0], last[1] + 1] : [last[0] + 1, last[1]];
  ordered.forEach((t, i) => {
    const next = ordered[i + 1];
    if (next && next[k] !== t[k] + 1) problems.push(`${where(next[0], next[1])}: the start line has a gap`);
  });
  for (const [x, y] of [before, after]) {
    if (isRoad(tileAt(rows, x, y))) problems.push(`${where(x, y)}: the start line does not cross the road from wall to wall`);
  }
  return problems;
}

/** A starting place that is not behind the line: it is crossed forwards towards the first waypoint. */
function lineBehindProblems(rows: readonly string[], line: StartLine): string[] {
  const across = line.axis === 'column' ? 0 : 1;
  const lineAt = at(line.tiles, 0, 'a tile of the line')[across];
  const sign = line.forward[across];
  return tilesOf(rows, 'S')
    .filter((p) => (p[across] - lineAt) * sign >= 0)
    .map((p) => `${where(p[0], p[1])}: starting place is not behind the start line`);
}

/** An item box off the road. */
function boxProblems(rows: readonly string[]): string[] {
  return tilesOf(rows, '?').filter(([x, y]) => !onRoad(rows, x, y)).map(([x, y]) => `${where(x, y)}: item box off the road`);
}

/** A prop that is not on a wall tile: on a road, kerb, line, box, start or verge tile (or off the map), or of a kind that does not exist. */
function propProblems({ rows, props = [] }: TrackSource): string[] {
  return props.flatMap(({ kind, x, y }) => {
    if (!PROP_KINDS.includes(kind)) return [`${where(x, y)}: unknown prop kind '${kind}'`];
    const tile = rows[y]?.[x];
    if (tile === 'X') return [];
    const what = tile === undefined ? 'off the map' : `on a ${tile === '.' ? 'verge' : isTileChar(tile) ? LEGEND[tile] : 'unknown'} tile`;
    return [`${where(x, y)}: a ${kind} stands ${what}, props stand on wall tiles only`];
  });
}

/** A circuit ready to race on: its tiles, the racing line and the starting places, in game pixels. */
export interface Track {
  readonly cols: number;
  readonly rows: number;
  /** The map's side in game pixels. */
  readonly size: { w: number; h: number };
  readonly map: readonly string[];
  /** The racing line, in driving order, at the tile centres. */
  readonly waypoints: readonly { x: number; y: number }[];
  /** The line's direction of travel, a unit step. */
  readonly forward: readonly [number, number];
  /** The heading of a kart on the grid: radians from east, y down. */
  readonly heading: number;
  /** The starting places, pole first, the last place last. */
  readonly places: readonly { x: number; y: number }[];
  /** The item boxes' centres. */
  readonly boxes: readonly { x: number; y: number }[];
  /** The props, at their tile centres. */
  readonly props: readonly { kind: PropKind; x: number; y: number }[];
  /** The arch over the start line: its legs' centres, one beyond each end of the line. */
  readonly arch: readonly [{ x: number; y: number }, { x: number; y: number }];
  /** The start line: its middle, and how far along `forward` the line stands (the dot product of the two). */
  readonly line: { readonly x: number; readonly y: number; readonly at: number };
}

const centre = ([x, y]: readonly [number, number]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });

/** The middle of the start line's tiles, and where it stands along the way forward. */
function lineCentre(tiles: readonly (readonly [number, number])[], forward: readonly [number, number]): Track['line'] {
  const cs = tiles.map(centre);
  const x = cs.reduce((sum, c) => sum + c.x, 0) / cs.length, y = cs.reduce((sum, c) => sum + c.y, 0) / cs.length;
  return { x, y, at: x * forward[0] + y * forward[1] };
}

/** A corner of the racing line: the waypoint's tile, the way the line turns there, and the unit step of the leg into it. */
export interface Corner {
  /** The waypoint's index in the racing line. */
  readonly index: number;
  readonly x: number;
  readonly y: number;
  /** As seen from above, y down: a right turn is clockwise. */
  readonly turn: 'left' | 'right';
  readonly into: readonly [number, number];
}

/** The turn, in degrees, past which a waypoint is a corner. */
const CORNER_DEGREES = 30;

/** The waypoints where the racing line (closed: the last joins the first) turns by more than 30°, each with the way it turns. */
export function cornersOf(track: Pick<Track, 'waypoints'>): Corner[] {
  const w = track.waypoints;
  const out: Corner[] = [];
  w.forEach((p, index) => {
    const a = at(w, (index + w.length - 1) % w.length, 'the previous waypoint'), b = at(w, (index + 1) % w.length, 'the next waypoint');
    const inx = p.x - a.x, iny = p.y - a.y, outx = b.x - p.x, outy = b.y - p.y;
    const turned = Math.abs(Math.atan2(inx * outy - iny * outx, inx * outx + iny * outy)) * 180 / Math.PI;
    if (turned <= CORNER_DEGREES) return;
    out.push({
      index, x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE),
      turn: inx * outy - iny * outx > 0 ? 'right' : 'left', into: [Math.sign(inx), Math.sign(iny)],
    });
  });
  return out;
}

/** The tile of the first wall beyond each end of the start line, walking out along it; the line's own end when there is none. */
function archLegs(rows: readonly string[], line: StartLine): [[number, number], [number, number]] {
  const { k, first, last } = lineEnds(line);
  const out = (from: [number, number], step: 1 | -1): [number, number] => {
    let [x, y] = from;
    while (tileAt(rows, x, y) !== 'X') { if (k === 1) y += step; else x += step; }
    return [x, y];
  };
  return [out(first, -1), out(last, 1)];
}

/** The circuit as the game uses it; throws, naming the problems, when `trackProblems` finds any. */
export function parseTrack(src: TrackSource = COMET_RING): Track {
  const problems = trackProblems(src);
  if (problems.length) throw new Error(`the circuit is not drivable: ${problems.join('; ')}`);
  const line = defined(lineOf(src), 'the start line');
  const across = line.axis === 'column' ? 0 : 1;
  const lineAt = at(line.tiles, 0, 'the line')[across];
  // Nearest the line first, then across the road in reading order.
  const places = tilesOf(src.rows, 'S')
    .sort((a, b) => Math.abs(a[across] - lineAt) - Math.abs(b[across] - lineAt) || (across === 0 ? a[1] - b[1] : a[0] - b[0]))
    .map(centre);
  const legs = archLegs(src.rows, line);
  const cols = src.rows[0]?.length ?? 0;
  return {
    cols, rows: src.rows.length, size: { w: cols * TILE, h: src.rows.length * TILE }, map: src.rows,
    waypoints: src.waypoints.map(centre), forward: line.forward, heading: Math.atan2(line.forward[1], line.forward[0]),
    places, boxes: tilesOf(src.rows, '?').map(centre), line: lineCentre(line.tiles, line.forward),
    props: (src.props ?? []).map(({ kind, x, y }) => ({ kind, ...centre([x, y]) })),
    arch: [centre(legs[0]), centre(legs[1])],
  };
}
