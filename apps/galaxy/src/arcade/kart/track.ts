// COMET RING, OMNI KART's one circuit (PRD 1359, redrawn in curves by PRD 1829): its road is drawn from a centre line (line.ts), the
// 14 waypoints in driving order, each corner an arc of its own radius, the road's width, the gaps over it, the shortcuts' pieces and the
// tunnel's span; beside it a text map, one character per 16px tile, places only the features. The map, the centre line and the checks live
// here, pure, so the circuit is proved drivable before anything is drawn. Rows and columns in every message count from 0, the way the
// waypoints' x and y do; the centre line's own coordinates are in tile units (a tile's centre is x + 0.5).
//
// The legend of the rows:
//   .  ground (nothing: the road, the kerbs, the roof and the walkway come from the centre line)   =  the start line (road)
//   ?  an item box (road)   S  a starting place (road)   +  a boost pad (road)   ^  a ramp (road)
// Stands (PRD 1775) and shortcuts are not in the map either: they are listed beside it.
// Props (PRD 1427) are not in the map: they are listed beside it, each a kind and a tile of void.
import { at, defined } from 'omni-loop/kit/lib/narrow.ts';
import { buildLine, crossings, gatesOf, inGapAt, isRoad as onTheRoad, locate, pointAt, roadInSpan, type Gate, type Line, type Located, type Piece, type Sample, type Span } from './line';

/** A tile's side in game pixels: the circuit's texture is one tile = 16×16 pixels. */
export const TILE = 16;
/** The laps a race runs. */
export const LAPS = 3;
/** The karts on the grid: the player and five rivals. */
export const PLACES = 6;

const LEGEND = Object.freeze({
  '.': 'ground', '=': 'line', '?': 'box', S: 'start', '+': 'boost pad', '^': 'ramp',
} as const);
type TileChar = keyof typeof LEGEND;

const isTileChar = (c: string): c is TileChar => Object.hasOwn(LEGEND, c);

/** The characters of a hand-written map of tiles (a fixture of the engine's tests, `groundOf`): `#` road, `r` kerb, `T` roofed road, `w` walkway, besides the features; `~` is the void. */
const FIXTURE_ROAD = '#r=?S+^Tw';

/** A stretch of a line that is void across the road, as written: where it starts, a point of the centre line in tile units, and its length in tiles. */
export interface SourceGap { readonly from: readonly [number, number]; readonly length: number }

/** A shortcut's own road, as written, in tile units: a straight centre line with its own width and gaps (their distances along the piece), added to the road. `surface: 'grating'` draws it as a walkway. */
export interface SourcePiece {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly width: number;
  readonly gaps?: readonly { readonly from: number; readonly length: number }[];
  readonly surface?: 'grating';
}

/**
 * A circuit as written: the features' rows, and the centre line: its waypoints as tile coordinates with each corner's radius [x, y, radius],
 * in driving order, the road's width, the gaps over the line, the pieces of the shortcuts and the tunnel's span (a start, a point of the line, and
 * a length).
 */
/** A disc of ice: the tile coordinates [x, y] of its middle and its radius in tiles. */
export interface IceDisc { readonly at: readonly [number, number]; readonly radius: number }

export interface TrackSource {
  readonly rows: readonly string[];
  readonly waypoints: readonly (readonly [number, number, number])[];
  /** The road's width in tiles. */
  readonly width: number;
  readonly gaps?: readonly SourceGap[];
  readonly pieces?: readonly SourcePiece[];
  readonly span?: { readonly from: readonly [number, number]; readonly length: number };
  /** What stands on the void tiles around the circuit; none when left out. */
  readonly props?: readonly Prop[];
  /** The road's ups and downs; flat when left out. */
  readonly relief?: Relief;
  /** The stands that float over the void, as tile coordinates [x, y] (PRD 1775); none when left out. */
  readonly stands?: readonly (readonly [number, number])[];
  /** The shortcuts, each beside the racing line (PRD 1775); none when left out. */
  readonly shortcuts?: readonly Shortcut[];
  /**
   * The frozen discs (PRD 1923, PRD 1963): the lake first, then the frozen patches, each the tile coordinates [x, y] of its middle and its radius in tiles. A circuit that has
   * any has a floor: `ice` inside any of them, `road` on the rest of the road, `powder` everywhere else, and no void; and a tree line at the map's edge.
   */
  readonly ice?: readonly IceDisc[];
}

/**
 * A shortcut as written (PRD 1775), in tile units [x, y]: the leg it drives, from the point where it leaves the centre line to the
 * point where it rejoins it, its gate (a line across it, from one end to the other), and `skips`, the
 * index of the first of the two consecutive waypoints it skips.
 */
export interface Shortcut {
  readonly leg: readonly [readonly [number, number], readonly [number, number]];
  readonly gate: readonly [readonly [number, number], readonly [number, number]];
  readonly skips: number;
}

/**
 * The road's ups and downs along the racing line (PRD 1698): the height of the road at each waypoint, and on each
 * leg (from waypoint i to the next) a hump (positive) or a dip (negative) at its middle, in world units. A leg eases
 * from one height to the next, and the road is level over every arc, so a corner never twists.
 */
export interface Relief { readonly heights: readonly number[]; readonly bumps: readonly number[] }

/** How far a shortcut stays level at its start, 2.5 tiles. */
export const LEVEL = 2.5 * TILE;

/** The most the relief may span, from its lowest road to its highest: under the camera's eye height (28), so the eye is never under a road. */
export const RELIEF_SPAN = 26;

/**
 * The road's height `d` along leg `i` of the relief, the leg being `length` long: easing from one waypoint's height to the next, its hump or
 * dip at the middle, and level for `level` at both ends (the straight between two arcs is level over the arcs themselves: none by default
 * on the centre line, `LEVEL` for a shortcut). No step anywhere.
 */
export function legHeight(relief: Relief, i: number, d: number, length: number, level = 0): number {
  const n = relief.heights.length;
  const from = relief.heights[i] ?? 0, to = relief.heights[(i + 1) % n] ?? 0, bump = relief.bumps[i] ?? 0;
  const t = Math.min(1, Math.max(0, (d - level) / Math.max(1, length - 2 * level)));
  const hump = Math.sin(Math.PI * t);
  return from + (to - from) * t * t * (3 - 2 * t) + bump * hump * hump;
}

/** What stands off the road: pylons and beacons along the circuit's edge, the rest deeper in; the station's lamps, dishes, cranes and containers (PRD 1775) stand near the road and around the station. */
export const PROP_KINDS = ['pylon', 'beacon', 'asteroid', 'satellite', 'wreck', 'lamp', 'dish', 'crane', 'container'] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/** A prop as written: its kind and the tile it stands on. */
export interface Prop { readonly kind: PropKind; readonly x: number; readonly y: number }

// 72×72 tiles. The road is five tiles wide. The racing line starts at the first corner after the line
// (the long start straight runs along the bottom, east), and its last waypoint is the corner before it. The rows hold the features only.
const COMET_RING_ROWS = [
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '................?..................................?....................',
  '................?..................................?....................',
  '........................................................................',
  '................?..................................?....................',
  '................?................^.................?....................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '.......................................??.??............................',
  '........................................................................',
  '........................................................................',
  '..............................................................^^^^^.....',
  '......??.??.............................................................',
  '................................?.......................................',
  '......+++++.....................?.......................................',
  '..............................................................+++++.....',
  '................................?.......................................',
  '......^^^^^.....................?.......................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '......................................................?++...............',
  '......................................................?++...............',
  '.......................................................++...............',
  '......................................................?++...............',
  '......................................................?++...............',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '............................................................^^^^^.......',
  '........................................................................',
  '.............++?........................................?...............',
  '.............++?........................................?...............',
  '.............++.........................................................',
  '.............++?........................................?...............',
  '.............++?........................................?...............',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '.........................++..S..S.=..........?....?.....................',
  '.........................++.......=..........?....?.....................',
  '.........................++..S..S.=.....................................',
  '.........................++.......=..........?....?.....................',
  '.........................++..S..S.=..........?....?.....................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
  '........................................................................',
] as const;

/**
 * The walkway's start, at the middle of the arc of waypoint 6 (centre (47.5, 16.5), radius 6, at 45° towards the north-west), in tile units.
 * Its axis lies on the row 12's middle, 2 tiles south of the top straight's (the arc's own middle is at 12.26, about 1.8): a ramp is a tile
 * of the rows and must be road to its corners, so the one-tile walkway lies on the grid.
 */
const WALK = { x: 47.5 - 6 / Math.SQRT2, y: 12.5 };

export const COMET_RING: TrackSource = {
  rows: COMET_RING_ROWS,
  // [x, y, radius]: the 14 corners in driving order, each rounded by an arc of its own radius (PRD 1829).
  waypoints: [
    [62, 62, 8], [62, 46, 3], [49, 46, 3], [49, 34, 3], [64, 34, 3], [64, 10, 5], [41, 10, 6],
    [41, 26, 4], [23, 26, 4], [23, 10, 4], [8, 10, 6], [8, 46, 4], [21, 46, 3], [21, 62, 3],
  ],
  width: 5,
  // The gap jump: three tiles of void from the end of the ramp (row 22) north, on the descent after the hairpin of waypoint 4.
  gaps: [{ from: [64.5, 22], length: 3 }],
  pieces: [
    // The hidden ramp's spur: leaves the corner of waypoint 1 straight on north, five tiles wide as the road; its ramp is on row 42, then a gap of 5 tiles.
    { from: [62.5, 49.5], to: [62.5, 35.5], width: 5, gaps: [{ from: 7.5, length: 5 }] },
    // The walkway: leaves the middle of the curve of waypoint 6 and heads west over the void to the curve of waypoint 9.
    // One tile wide, a ramp (row 12, column 33) and then a gap in its middle.
    { from: [WALK.x, WALK.y], to: [24.5, WALK.y], width: 1, surface: 'grating', gaps: [{ from: WALK.x - 33, length: 3.35 }] },
  ],
  // The tunnel: from where the curve of waypoint 5 starts, 13 tiles along the line: the quarter circle of the curve, then the straight west.
  span: { from: [64.5, 15.5], length: 13 },
  // The relief (PRD 1698): a hill and a valley on the top and west legs, the climb back and a roller coaster
  // down the west side. The start straight is flat.
  relief: {
    heights: [0, 12, 12, 20, 20, 4, 4, 0, 0, 12, 12, 2, 2, 0],
    bumps: [0, 0, 0, -5, 6, 12, 0, -4, 0, 0, 10, 0, 8, 0],
  },
  // Pylons and beacons alternate along the void near the road's edge; asteroids, satellites and
  // wrecks float deeper in; the station (PRD 1775): neon lamps and dishes along the road's edge, cranes and containers around the tunnel and the docks.
  // Every one is on a void tile, clear of the road's edge.
  props: [
    { kind: 'pylon', x: 8, y: 5 }, { kind: 'beacon', x: 12, y: 5 }, { kind: 'pylon', x: 21, y: 5 }, { kind: 'beacon', x: 41, y: 5 },
    { kind: 'pylon', x: 44, y: 5 }, { kind: 'beacon', x: 53, y: 5 }, { kind: 'pylon', x: 61, y: 5 }, { kind: 'beacon', x: 68, y: 10 },
    { kind: 'pylon', x: 28, y: 9 }, { kind: 'beacon', x: 3, y: 12 }, { kind: 'pylon', x: 36, y: 15 }, { kind: 'beacon', x: 69, y: 12 },
    { kind: 'pylon', x: 14, y: 15 }, { kind: 'beacon', x: 47, y: 15 }, { kind: 'pylon', x: 55, y: 15 }, { kind: 'beacon', x: 28, y: 18 },
    { kind: 'pylon', x: 3, y: 20 }, { kind: 'beacon', x: 69, y: 21 }, { kind: 'pylon', x: 13, y: 24 }, { kind: 'beacon', x: 46, y: 26 },
    { kind: 'pylon', x: 59, y: 24 }, { kind: 'beacon', x: 3, y: 28 }, { kind: 'pylon', x: 69, y: 29 }, { kind: 'beacon', x: 23, y: 31 },
    { kind: 'pylon', x: 29, y: 31 }, { kind: 'beacon', x: 37, y: 31 }, { kind: 'pylon', x: 44, y: 34 }, { kind: 'beacon', x: 13, y: 35 },
    { kind: 'pylon', x: 3, y: 36 }, { kind: 'beacon', x: 65, y: 38 }, { kind: 'pylon', x: 54, y: 39 }, { kind: 'beacon', x: 44, y: 40 },
    { kind: 'pylon', x: 21, y: 41 }, { kind: 'beacon', x: 3, y: 44 }, { kind: 'pylon', x: 67, y: 46 }, { kind: 'beacon', x: 23, y: 44 },
    { kind: 'pylon', x: 47, y: 48 }, { kind: 'beacon', x: 4, y: 46 }, { kind: 'pylon', x: 12, y: 51 }, { kind: 'beacon', x: 50, y: 51 },
    { kind: 'pylon', x: 67, y: 51 }, { kind: 'beacon', x: 26, y: 53 }, { kind: 'pylon', x: 34, y: 57 }, { kind: 'beacon', x: 42, y: 57 },
    { kind: 'pylon', x: 57, y: 56 }, { kind: 'beacon', x: 16, y: 58 }, { kind: 'pylon', x: 67, y: 58 }, { kind: 'beacon', x: 16, y: 62 },
    { kind: 'pylon', x: 67, y: 62 }, { kind: 'beacon', x: 23, y: 67 }, { kind: 'pylon', x: 32, y: 67 }, { kind: 'beacon', x: 39, y: 67 },
    { kind: 'pylon', x: 47, y: 67 }, { kind: 'beacon', x: 55, y: 67 }, { kind: 'asteroid', x: 41, y: 3 }, { kind: 'satellite', x: 32, y: 20 },
    { kind: 'wreck', x: 50, y: 18 }, { kind: 'asteroid', x: 16, y: 33 }, { kind: 'satellite', x: 30, y: 34 }, { kind: 'wreck', x: 41, y: 34 },
    { kind: 'asteroid', x: 70, y: 46 }, { kind: 'satellite', x: 36, y: 43 }, { kind: 'wreck', x: 29, y: 52 }, { kind: 'asteroid', x: 48, y: 52 },
    { kind: 'satellite', x: 70, y: 52 }, { kind: 'wreck', x: 1, y: 46 }, { kind: 'asteroid', x: 54, y: 54 }, { kind: 'satellite', x: 13, y: 59 },
    { kind: 'wreck', x: 70, y: 62 }, { kind: 'asteroid', x: 4, y: 62 }, { kind: 'lamp', x: 8, y: 7 }, { kind: 'lamp', x: 18, y: 5 },
    { kind: 'lamp', x: 41, y: 7 }, { kind: 'lamp', x: 49, y: 15 }, { kind: 'lamp', x: 57, y: 15 }, { kind: 'lamp', x: 59, y: 5 },
    { kind: 'lamp', x: 68, y: 8 }, { kind: 'lamp', x: 36, y: 21 }, { kind: 'lamp', x: 3, y: 30 }, { kind: 'lamp', x: 13, y: 30 },
    { kind: 'lamp', x: 16, y: 52 }, { kind: 'lamp', x: 26, y: 55 }, { kind: 'dish', x: 30, y: 9 }, { kind: 'dish', x: 34, y: 15 },
    { kind: 'dish', x: 55, y: 5 }, { kind: 'dish', x: 70, y: 16 }, { kind: 'dish', x: 3, y: 24 }, { kind: 'dish', x: 25, y: 36 },
    { kind: 'dish', x: 18, y: 63 }, { kind: 'crane', x: 50, y: 5 }, { kind: 'crane', x: 59, y: 15 }, { kind: 'crane', x: 46, y: 6 },
    { kind: 'crane', x: 28, y: 21 }, { kind: 'crane', x: 13, y: 17 }, { kind: 'crane', x: 14, y: 39 }, { kind: 'crane', x: 57, y: 53 },
    { kind: 'container', x: 51, y: 15 }, { kind: 'container', x: 48, y: 5 }, { kind: 'container', x: 63, y: 6 }, { kind: 'container', x: 46, y: 17 },
    { kind: 'container', x: 29, y: 55 }, { kind: 'container', x: 35, y: 54 }, { kind: 'container', x: 2, y: 48 },
  ],
  // Twelve stands over the void: four on each side of the start straight and four beside the gap jump.
  stands: [
    [30, 57], [38, 57], [46, 57], [52, 57], [30, 67], [37, 67], [44, 67], [51, 67],
    [70, 18], [70, 25], [58, 18], [58, 27],
  ],
  // The shortcuts (PRD 1775), each leaving the main line where it turns and with its gate beside the racing line, after the hard part.
  // The hidden ramp leaves the corner of waypoint 1 straight on north and rejoins the leg of waypoints 3 and 4; its gate runs across the road at row 36.
  // The walkway leaves the middle of the curve of waypoint 6 straight on west to the curve of waypoint 9; its gate runs across it at column 27.
  shortcuts: [
    { leg: [[62.5, 46.5], [62.5, 34.5]], gate: [[60, 36.5], [65, 36.5]], skips: 2 },
    { leg: [[WALK.x, WALK.y], [24.5, WALK.y]], gate: [[27, WALK.y - 1], [27, WALK.y + 1]], skips: 7 },
  ],
};

/** The rows of a 72×72 circuit: all ground, with the features at [character, x, y]. */
function featureRows(features: readonly (readonly [string, number, number])[]): string[] {
  const grid = Array.from({ length: 72 }, () => Array.from({ length: 72 }, () => '.'));
  for (const [c, x, y] of features) { const row = grid[y]; if (row) row[x] = c; }
  return grid.map((r) => r.join(''));
}

/** Tiles `c` at every [x, y] of the columns by the rows. */
const block = (c: string, xs: readonly number[], ys: readonly number[]): (readonly [string, number, number])[] => ys.flatMap((y) => xs.map((x) => [c, x, y] as const));

/**
 * FROST EIGHT, OMNI KART's second circuit (PRD 1923): a figure eight standing up on 72×72 tiles, the road 5 tiles wide. The top loop is driven clockwise and
 * the bottom one anticlockwise, and the two diagonals cross at about 62° on a frozen lake 12 tiles across at the middle of the map. The ground is level
 * over the lake: both diagonals start and end at the base height, so both branches stand at one height there; the top loop climbs to a pass on the top
 * straight and comes down to the lake. There is no void: the lake is ice, the road is road, the rest is powder, and the tree line stops a kart at the edge.
 * The start line crosses the start straight at x = 32 with six places behind it; item boxes stand on the top straight and past the line, a pad on the right of each loop.
 */
export const FROST_EIGHT: TrackSource = {
  rows: featureRows([
    ...block('=', [32], [62, 63, 64, 65, 66]),
    ...block('S', [30, 28, 26], [63, 65]),
    ...block('?', [30, 34], [6, 8, 10]), ...block('?', [42, 46], [62, 64, 66]),
    ...block('+', [56, 57], [15, 16, 17]), ...block('+', [56, 57], [54, 55, 56]),
  ]),
  // [x, y, radius]: the 8 corners in driving order.
  waypoints: [[56, 64, 5], [56, 48, 4], [16, 24, 4], [16, 8, 5], [56, 8, 5], [56, 24, 4], [16, 48, 4], [16, 64, 5]],
  width: 5,
  // The ice (PRD 1923, PRD 1963): the lake first, a disc 12 tiles across on the crossing, then two frozen patches 6 tiles across, on the middle of bend 4's curve and of bend 8's.
  ice: [{ at: [36, 36], radius: 6 }, { at: [16, 8], radius: 3 }, { at: [16, 64], radius: 3 }],
  // The relief: the diagonals stand at the base height at both ends, with no hump, so both are level over the lake; the top loop climbs to a pass on the top straight.
  relief: { heights: [0, 0, 0, 14, 14, 0, 0, 0], bumps: [0, 0, 0, 6, 0, 0, 0, 0] },
};

/** A tile that is road under the wheels of a hand-written map of tiles: the road, a kerb, the line, a box, a starting place, a pad, a ramp, roofed road or a walkway. */
const isRoadChar = (c: string): boolean => c.length === 1 && FIXTURE_ROAD.includes(c);

/** The tile at column x, row y; the void past the map's edge. */
export function tileAt(rows: readonly string[], x: number, y: number): string {
  return rows[y]?.[x] ?? '~';
}

/**
 * What the engine reads of the circuit: the map's rows (the pads and the ramps are still tiles), its side in game
 * pixels, and masks of the whole map at the pixel, baked once and read in constant time by `roadAt` and `roofAt` (PRD 1829).
 */
export interface Ground {
  readonly map: readonly string[];
  readonly size: { readonly w: number; readonly h: number };
  /** 1 where the pixel is road under the wheels, row by row, `size.w` to a row. */
  readonly road: Uint8Array;
  /** 1 where the pixel is roofed road (a roof stands over it), laid out as `road`. */
  readonly roof: Uint8Array;
  /** 1 where the pixel is void inside a gap (a kart flies over it, so it closes the circuit's inside as the road does), laid out as `road`; none for a hand-written map. */
  readonly gap?: Uint8Array;
  /** The surface at each pixel (PRD 1923), laid out as `road`: `FLOOR` codes; none on a circuit with road and void only (COMET RING), where it is read from `road`. A circuit that has it has no void and a tree line. */
  readonly floor?: Uint8Array;
}

/** What a kart drives on (PRD 1923): road, ice, powder or void. */
export type Surface = 'road' | 'ice' | 'powder' | 'void';

/** The codes of `Ground.floor`. */
export const FLOOR: Readonly<Record<Surface, number>> = { void: 0, road: 1, ice: 2, powder: 3 };
const SURFACE_OF: readonly Surface[] = ['void', 'road', 'ice', 'powder'];

/** Marks the pixels of the tile at column `tx`, row `ty` in `mask`, a map `w` pixels wide. */
function paintTile(mask: Uint8Array, w: number, tx: number, ty: number, value = 1): void {
  for (let y = ty * TILE; y < (ty + 1) * TILE; y++) mask.fill(value, y * w + tx * TILE, y * w + (tx + 1) * TILE);
}

/** The ground of a hand-written map of tiles (a fixture): its road and its roof, read from the tiles at every pixel. */
export function groundOf(rows: readonly string[]): Ground {
  const cols = rows[0]?.length ?? 0;
  const w = cols * TILE, h = rows.length * TILE;
  const road = new Uint8Array(w * h), roof = new Uint8Array(w * h);
  rows.forEach((row, ty) => {
    Array.from(row).forEach((c, tx) => {
      if (isRoadChar(c)) paintTile(road, w, tx, ty);
      if (c === 'T') paintTile(roof, w, tx, ty);
    });
  });
  const surfaced = rows.some((row) => /[ip]/.test(row));
  if (!surfaced) return { map: rows, size: { w, h }, road, roof };
  // `i` is ice and `p` powder: a fixture that has either has a floor (and no void off the road but `~`), and a tree line.
  const floor = new Uint8Array(w * h);
  rows.forEach((row, ty) => {
    Array.from(row).forEach((c, tx) => {
      const code = c === 'i' ? FLOOR.ice : c === 'p' ? FLOOR.powder : isRoadChar(c) ? FLOOR.road : FLOOR.void;
      if (code !== FLOOR.void) paintTile(floor, w, tx, ty, code);
    });
  });
  return { map: rows, size: { w, h }, road, roof, floor };
}

const pixelIn = (g: Pick<Ground, 'size'>, x: number, y: number): number => {
  const px = Math.floor(x), py = Math.floor(y);
  return px >= 0 && py >= 0 && px < g.size.w && py < g.size.h ? py * g.size.w + px : -1;
};

/** Whether the pixel at `x`, `y` is road under the wheels; the void past the map's edge. */
export function roadAt(g: Pick<Ground, 'size' | 'road'>, x: number, y: number): boolean {
  const i = pixelIn(g, x, y);
  return i >= 0 && g.road[i] === 1;
}

/** The surface at the pixel at `x`, `y` (PRD 1923): `road` where `roadAt` is true and `void` elsewhere on a circuit without a `floor`; the void past the map's edge. */
export function surfaceAt(g: Pick<Ground, 'size' | 'road' | 'floor'>, x: number, y: number): Surface {
  const i = pixelIn(g, x, y);
  if (i < 0) return 'void';
  if (g.floor) return SURFACE_OF[g.floor[i] ?? 0] ?? 'void';
  return g.road[i] === 1 ? 'road' : 'void';
}

/** Whether the pixel at `x`, `y` is past the tree line (PRD 1923): on a circuit with a `floor`, within a tile of the map's edge or off it. A kart stops there, as at a wall. */
export function pastTreeLine(g: Pick<Ground, 'size' | 'floor'>, x: number, y: number): boolean {
  return g.floor !== undefined && (x < TILE || y < TILE || x >= g.size.w - TILE || y >= g.size.h - TILE);
}

/** Whether the pixel at `x`, `y` is roofed road. */
export function roofAt(g: Pick<Ground, 'size' | 'roof'>, x: number, y: number): boolean {
  const i = pixelIn(g, x, y);
  return i >= 0 && g.roof[i] === 1;
}

/** The centre line of a circuit as written, and what is baked from it. */
interface Baked { readonly line: Line; readonly span: Span | null; readonly road: Uint8Array; readonly roof: Uint8Array; readonly gap: Uint8Array; readonly floor?: Uint8Array }

const baked = new WeakMap<object, { src: TrackSource; made: Baked }[]>();

/** The centre line of `src`: its arcs, gaps, pieces and span, in tile units. Throws when a corner's arc does not fit its legs. */
function centreOf(src: TrackSource): { line: Line; span: Span | null } {
  const points = src.waypoints.map(([x, y, radius]) => ({ x: x + 0.5, y: y + 0.5, radius }));
  const bare = buildLine({ points, width: src.width });
  const alongOf = ([x, y]: readonly [number, number]) => locate(bare, x, y).along;
  const gaps = (src.gaps ?? []).map((g) => ({ from: alongOf(g.from), length: g.length }));
  const pieces: Piece[] = (src.pieces ?? []).map((p) => ({
    from: { x: p.from[0], y: p.from[1] }, to: { x: p.to[0], y: p.to[1] }, width: p.width,
    ...(p.gaps ? { gaps: p.gaps } : {}), ...(p.surface ? { surface: p.surface } : {}),
  }));
  const line = buildLine({ points, width: src.width, gaps, pieces });
  return { line, span: src.span ? { start: alongOf(src.span.from), length: src.span.length } : null };
}

/** The pixels worth asking about: those inside the bounding box of a segment or a piece, widened by half the road's width. One byte per pixel, 1 to ask. */
function candidates(line: Line, w: number, h: number): Uint8Array {
  const todo = new Uint8Array(w * h);
  const cover = (x0: number, y0: number, x1: number, y1: number) => {
    const ax = Math.max(0, Math.floor(x0 * TILE)), bx = Math.min(w, Math.ceil(x1 * TILE));
    for (let y = Math.max(0, Math.floor(y0 * TILE)); y < Math.min(h, Math.ceil(y1 * TILE)); y++) if (bx > ax) todo.fill(1, y * w + ax, y * w + bx);
  };
  const reach = line.width / 2 + 0.01;
  for (const s of line.segments) {
    const [x0, y0, x1, y1, r]: [number, number, number, number, number] = s.kind === 'straight' ? [s.x, s.y, s.x + s.tx * s.len, s.y + s.ty * s.len, 0] : [s.cx, s.cy, s.cx, s.cy, s.r];
    cover(Math.min(x0, x1) - r - reach, Math.min(y0, y1) - r - reach, Math.max(x0, x1) + r + reach, Math.max(y0, y1) + r + reach);
  }
  for (const p of line.pieces) {
    const pad = p.width / 2 + 0.01;
    cover(Math.min(p.from.x, p.to.x) - pad, Math.min(p.from.y, p.to.y) - pad, Math.max(p.from.x, p.to.x) + pad, Math.max(p.from.y, p.to.y) + pad);
  }
  return todo;
}

/** Bakes the road, the roof and the gaps at the pixel: only where the centre line, or a piece, comes within half its width are the pixels asked. */
function bake(line: Line, span: Span | null, cols: number, rows: number): Pick<Baked, 'road' | 'roof' | 'gap'> {
  const w = cols * TILE, h = rows * TILE;
  const road = new Uint8Array(w * h), roof = new Uint8Array(w * h), gap = new Uint8Array(w * h);
  const todo = candidates(line, w, h);
  for (let i = 0; i < todo.length; i++) {
    if (todo[i] === 0) continue;
    const x = ((i % w) + 0.5) / TILE, y = (Math.floor(i / w) + 0.5) / TILE;
    if (!onTheRoad(line, x, y)) {
      gap[i] = inGapAt(line, x, y) ? 1 : 0;
      continue;
    }
    road[i] = 1;
    roof[i] = span && roadInSpan(line, span, x, y) ? 1 : 0;
  }
  return { road, roof, gap };
}

/** The floor of a circuit with ice (PRD 1923): ice inside any disc, road where the road is, powder everywhere else. */
function floorOf(road: Uint8Array, w: number, discs: readonly IceDisc[]): Uint8Array {
  const floor = new Uint8Array(road.length);
  for (let i = 0; i < floor.length; i++) {
    const x = (i % w) + 0.5, y = Math.floor(i / w) + 0.5;
    // A disc is measured only when the pixel is within its radius along both axes; beyond that it cannot be inside.
    const frozen = discs.some((d) => {
      const dx = x - (d.at[0] + 0.5) * TILE, dy = y - (d.at[1] + 0.5) * TILE, r = d.radius * TILE;
      return Math.abs(dx) <= r && Math.abs(dy) <= r && Math.hypot(dx, dy) < r;
    });
    floor[i] = frozen ? FLOOR.ice : road[i] === 1 ? FLOOR.road : FLOOR.powder;
  }
  return floor;
}

/** The centre line and the baked ground of `src`, made once for the same waypoints, width, gaps, pieces, span and size. */
function bakedOf(src: TrackSource): Baked {
  const known = baked.get(src.waypoints)?.find((k) => k.src.width === src.width && k.src.gaps === src.gaps && k.src.pieces === src.pieces && k.src.span === src.span && k.src.ice === src.ice
    && k.src.rows.length === src.rows.length && k.src.rows[0]?.length === src.rows[0]?.length);
  if (known) return known.made;
  const { line, span } = centreOf(src);
  const cols = src.rows[0]?.length ?? 0;
  const ground = bake(line, span, cols, src.rows.length);
  const made: Baked = { line, span, ...ground, ...(src.ice ? { floor: floorOf(ground.road, cols * TILE, src.ice) } : {}) };
  baked.set(src.waypoints, [...(baked.get(src.waypoints) ?? []), { src, made }]);
  return made;
}

/** The ground of a circuit as written. */
const groundFor = (src: TrackSource, b: Baked): Ground => {
  const cols = src.rows[0]?.length ?? 0;
  return { map: src.rows, size: { w: cols * TILE, h: src.rows.length * TILE }, road: b.road, roof: b.roof, gap: b.gap, ...(b.floor ? { floor: b.floor } : {}) };
};

const where = (x: number, y: number) => `row ${y}, col ${x}`;

/** The tiles of one character, as [x, y] in reading order. */
function tilesOf(rows: readonly string[], c: string): [number, number][] {
  const out: [number, number][] = [];
  rows.forEach((row, y) => { Array.from(row).forEach((t, x) => { if (t === c) out.push([x, y]); }); });
  return out;
}

/** Whether the whole of the tile at x, y is road: its centre and its four corners, a pixel in. */
function tileOnRoad(g: Pick<Ground, 'size' | 'road'>, x: number, y: number): boolean {
  return [[0.5, 0.5], [0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98]].every(([dx, dy]) => roadAt(g, (x + (dx ?? 0)) * TILE, (y + (dy ?? 0)) * TILE));
}

/** Whether no road lies within a tile of the centre of the tile x, y. */
function clearOfRoad(g: Pick<Ground, 'size' | 'road'>, x: number, y: number): boolean {
  for (let dy = -TILE; dy <= TILE; dy += TILE / 2) {
    for (let dx = -TILE; dx <= TILE; dx += TILE / 2) if (roadAt(g, (x + 0.5) * TILE + dx, (y + 0.5) * TILE + dy)) return false;
  }
  return true;
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
 * What is wrong with a circuit, each problem with the row and the column it is at: an unknown character, rows of unequal length, a centre
 * line whose arcs do not fit its legs, not exactly six starting places behind the line, a start line that does not cross the road from wall
 * to wall, a place, a pad, a ramp or a box off the road, a prop or a stand off a void tile or within a tile of the road's edge, a relief
 * with a height or a bump missing or not a number, or spanning more than `RELIEF_SPAN`, a shortcut skipping waypoints that do not exist, with
 * a leg whose ends are off the road, or with a gate crossing no road. Empty when it is drivable.
 */
export function trackProblems(src: TrackSource = COMET_RING): string[] {
  const shape = shapeProblems(src.rows);
  if (shape.length) return shape;
  let b: Baked;
  try {
    b = bakedOf(src);
  } catch (e) {
    return [`the centre line cannot be drawn: ${e instanceof Error ? e.message : String(e)}`];
  }
  const g = groundFor(src, b);
  return [
    ...placeProblems(src.rows, g), ...lineProblems(src, g), ...featureProblems(src.rows, g), ...propProblems(src, g), ...reliefProblems(src, b.line),
    ...standProblems(src, g), ...shortcutProblems(src, g), ...crossingProblems(src, b.line),
  ];
}

/** How far from the crossing, in tiles, the ground must be level: the half of the 12 tiles of the lake a line crosses on (PRD 1923). */
const LAKE_RADIUS = 6;
/** How near the crossing, in tiles, no gate and no start line may stand. */
const CROSSING_CLEAR = 8;
/** The least angle, in degrees, a line may cross itself at. */
const CROSSING_ANGLE = 60;

/** The distance from a point to a segment. */
function nearSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const k = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (ax + dx * k), y - (ay + dy * k));
}

/** On a line that crosses itself (PRD 1923): ground that is not level within the lake, a gate or a start line within `CROSSING_CLEAR` tiles of the crossing, or a crossing under `CROSSING_ANGLE` degrees. A line that does not cross itself has none. */
function crossingProblems(src: TrackSource, line: Line): string[] {
  return crossings(line).flatMap((c) => {
    const spot = `crossing at row ${Math.floor(c.y)}, col ${Math.floor(c.x)}`;
    const problems: string[] = [];
    if (c.angle < CROSSING_ANGLE) problems.push(`${spot}: the two branches cross at ${Math.round(c.angle)} degrees, at least ${CROSSING_ANGLE} are needed`);
    if (src.relief) {
      const relief = src.relief;
      const height = (leg: number, len: number, d: number) => legHeight(relief, leg, d * TILE, len * TILE);
      const lens = new Map(line.segments.flatMap((s) => (s.kind === 'straight' ? [[s.leg, s.len] as const] : [])));
      const heights = [c.a, c.b].flatMap((b) => {
        const len = lens.get(b.leg) ?? 0;
        return Array.from({ length: 13 }, (_, k) => height(b.leg, len, Math.min(len, Math.max(0, b.at + ((k - 6) / 6) * LAKE_RADIUS))));
      });
      if (Math.max(...heights) - Math.min(...heights) > 0.05) problems.push(`${spot}: the ground is not level within ${LAKE_RADIUS} tiles of it, both branches must stand at one height`);
    }
    const gate = gatesOf(line).find((gt) => nearSegment(c.x, c.y, gt.ax, gt.ay, gt.bx, gt.by) < CROSSING_CLEAR);
    if (gate) problems.push(`${spot}: the gate of waypoint ${gate.index} is within ${CROSSING_CLEAR} tiles of it`);
    const start = tilesOf(src.rows, '=').find(([x, y]) => Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) < CROSSING_CLEAR);
    if (start) problems.push(`${spot}: the start line is within ${CROSSING_CLEAR} tiles of it`);
    return problems;
  });
}

/** A relief with a height or a bump missing or one too many, a number that is not one, or a road spanning more than `RELIEF_SPAN`. */
function reliefProblems({ waypoints, relief }: TrackSource, line: Line): string[] {
  if (!relief) return [];
  const { heights, bumps } = relief;
  const n = waypoints.length;
  if (heights.length !== n || bumps.length !== n) return [`the relief needs ${n} heights and ${n} bumps, one a waypoint and one a leg: ${heights.length} and ${bumps.length} found`];
  if (![...heights, ...bumps].every((v) => typeof v === 'number' && Number.isFinite(v))) return ['the relief has a height or a bump that is not a number'];
  // Sampled along every straight, at the length the arcs leave it; the arcs are level.
  const tops = [...heights, ...line.segments.flatMap((s) => {
    if (s.kind !== 'straight') return [];
    return Array.from({ length: 33 }, (_, k) => legHeight(relief, s.leg, (k / 32) * s.len * TILE, s.len * TILE));
  })];
  const span = Math.round((Math.max(...tops) - Math.min(...tops)) * 10) / 10;
  return span > RELIEF_SPAN ? [`the road rises ${span} over its lowest point, more than ${RELIEF_SPAN}`] : [];
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

/** Not exactly six starting places, or one off the road. */
function placeProblems(rows: readonly string[], g: Ground): string[] {
  const problems: string[] = [];
  const places = tilesOf(rows, 'S');
  if (places.length !== PLACES) {
    const [x, y] = places[PLACES] ?? places[places.length - 1] ?? [0, 0];
    problems.push(`${where(x, y)}: ${PLACES} starting places expected, ${places.length} found`);
  }
  for (const [x, y] of places) if (!tileOnRoad(g, x, y)) problems.push(`${where(x, y)}: starting place off the road`);
  return problems;
}

/** A start line that is missing, crooked, gapped, not crossing the road from wall to wall, or with a starting place not behind it. */
function lineProblems(src: TrackSource, g: Ground): string[] {
  const line = lineOf(src);
  if (!line) {
    const lineStart = tilesOf(src.rows, '=')[0];
    const [x, y] = lineStart ?? [0, 0];
    return [`${where(x, y)}: ${lineStart ? 'the start line is not one straight run' : 'no start line'}`];
  }
  return [...lineShapeProblems(g, line), ...lineBehindProblems(src.rows, line), ...tilesOf(src.rows, '=').filter(([x, y]) => !tileOnRoad(g, x, y)).map(([x, y]) => `${where(x, y)}: start line off the road`)];
}

/** The line's tiles in order along it, the coordinate `k` it runs along (1 for a column), and its two ends. */
function lineEnds(line: StartLine) {
  const k: 0 | 1 = line.axis === 'column' ? 1 : 0;
  const ordered = [...line.tiles].sort((a, b) => a[k] - b[k]);
  return { k, ordered, first: at(ordered, 0, 'the first tile of the line'), last: at(ordered, ordered.length - 1, 'the last tile of the line') };
}

/** A start line with a gap, or one that does not cross the road from wall to wall. */
function lineShapeProblems(g: Ground, line: StartLine): string[] {
  const problems: string[] = [];
  const { k, ordered, first, last } = lineEnds(line);
  const before: [number, number] = line.axis === 'column' ? [first[0], first[1] - 1] : [first[0] - 1, first[1]];
  const after: [number, number] = line.axis === 'column' ? [last[0], last[1] + 1] : [last[0] + 1, last[1]];
  ordered.forEach((t, i) => {
    const next = ordered[i + 1];
    if (next && next[k] !== t[k] + 1) problems.push(`${where(next[0], next[1])}: the start line has a gap`);
  });
  for (const [x, y] of [before, after]) {
    if (roadAt(g, (x + 0.5) * TILE, (y + 0.5) * TILE)) problems.push(`${where(x, y)}: the start line does not cross the road from wall to wall`);
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

/** An item box, a boost pad or a ramp off the road. */
function featureProblems(rows: readonly string[], g: Ground): string[] {
  return ([['?', 'item box'], ['+', 'boost pad'], ['^', 'ramp']] as const)
    .flatMap(([c, name]) => tilesOf(rows, c).filter(([x, y]) => !tileOnRoad(g, x, y)).map(([x, y]) => `${where(x, y)}: ${name} off the road`));
}

/** A prop that is not on a void tile clear of the road's edge (or off the map), or of a kind that does not exist. */
function propProblems({ rows, props = [] }: TrackSource, g: Ground): string[] {
  return props.flatMap(({ kind, x, y }) => {
    if (!PROP_KINDS.includes(kind)) return [`${where(x, y)}: unknown prop kind '${kind}'`];
    if (rows[y]?.[x] === undefined) return [`${where(x, y)}: a ${kind} stands off the map, props stand on void tiles only`];
    return clearOfRoad(g, x, y) ? [] : [`${where(x, y)}: a ${kind} stands on the road or within a tile of its edge, props stand on void tiles only`];
  });
}

/** A stand that is not on a void tile clear of the road's edge (or off the map). */
function standProblems({ rows, stands = [] }: TrackSource, g: Ground): string[] {
  return stands.flatMap(([x, y]) => {
    if (rows[y]?.[x] === undefined) return [`${where(x, y)}: a stand floats off the map, stands float over void tiles only`];
    return clearOfRoad(g, x, y) ? [] : [`${where(x, y)}: a stand floats on the road or within a tile of its edge, stands float over void tiles only`];
  });
}

/** A shortcut skipping waypoints that do not exist, a leg whose ends are not on road, or a gate that crosses no road. */
function shortcutProblems({ waypoints, shortcuts = [] }: TrackSource, g: Ground): string[] {
  return shortcuts.flatMap(({ leg, gate, skips }, i) => {
    const problems: string[] = [];
    if (!Number.isInteger(skips) || skips < 0 || skips + 1 >= waypoints.length) {
      problems.push(`shortcut ${i} skips waypoints ${skips} and ${skips + 1}, the circuit has ${waypoints.length}`);
    }
    for (const [x, y] of leg) if (!roadAt(g, x * TILE, y * TILE)) problems.push(`${where(Math.floor(x), Math.floor(y))}: an end of shortcut ${i}'s leg is off the road`);
    const crosses = Array.from({ length: 17 }, (_, k) => k / 16).some((t) => roadAt(g, (gate[0][0] + (gate[1][0] - gate[0][0]) * t) * TILE, (gate[0][1] + (gate[1][1] - gate[0][1]) * t) * TILE));
    if (!crosses) problems.push(`${where(Math.floor(gate[0][0]), Math.floor(gate[0][1]))}: the gate of shortcut ${i} crosses no road`);
    return problems;
  });
}

/** A circuit ready to race on: its tiles, the centre line, the racing line and the starting places, in game pixels. */
export interface Track extends Ground {
  readonly cols: number;
  readonly rows: number;
  /** The corners of the racing line, at the waypoints' tile centres, in driving order. */
  readonly waypoints: readonly { x: number; y: number }[];
  /** The centre line (line.ts), in tile units: the road's shape, the racing line the rivals drive. */
  readonly centre: Line;
  /** The tunnel's span along the centre line, in tile units; none for a circuit without one. */
  readonly span: Span | null;
  /** The gate of every waypoint, in game pixels (along included): the line normal to the centre line at the middle of its arc. */
  readonly gates: readonly Gate[];
  /** The length of the centre line, a lap, in game pixels. */
  readonly length: number;
  /** Where the start line stands along the centre line, in game pixels. */
  readonly startAlong: number;
  /** The line's direction of travel, a unit step. */
  readonly forward: readonly [number, number];
  /** The heading of a kart on the grid: radians from east, y down. */
  readonly heading: number;
  /** The starting places, pole first, the last place last. */
  readonly places: readonly { x: number; y: number }[];
  /** The item boxes' centres. */
  readonly boxes: readonly { x: number; y: number }[];
  /** The road's ups and downs: a flat road for a circuit with none. */
  readonly relief: Relief;
  /** The stands, at their tile centres. */
  readonly stands: readonly { x: number; y: number }[];
  /** The shortcuts: the leg each drives, its gate (a line across it) and the index of the first of the two waypoints it skips; all in game pixels. */
  readonly shortcuts: readonly { readonly from: { x: number; y: number }; readonly to: { x: number; y: number }; readonly gate: readonly [{ x: number; y: number }, { x: number; y: number }]; readonly skips: number }[];
  /** The props, at their tile centres. */
  readonly props: readonly { kind: PropKind; x: number; y: number }[];
  /** The arch over the start line: its legs' centres, one beyond each end of the line. */
  readonly arch: readonly [{ x: number; y: number }, { x: number; y: number }];
  /** The start line: its middle, and how far along `forward` the line stands (the dot product of the two). */
  readonly line: { readonly x: number; readonly y: number; readonly at: number };
}

const centre = ([x, y]: readonly [number, number, ...number[]]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
const toPx = ([x, y]: readonly [number, number]) => ({ x: x * TILE, y: y * TILE });

/** The middle of the start line's tiles, and where it stands along the way forward. */
function lineCentre(tiles: readonly (readonly [number, number])[], forward: readonly [number, number]): Track['line'] {
  const cs = tiles.map(centre);
  const x = cs.reduce((sum, c) => sum + c.x, 0) / cs.length, y = cs.reduce((sum, c) => sum + c.y, 0) / cs.length;
  return { x, y, at: x * forward[0] + y * forward[1] };
}

/** Where a point of the circuit, in game pixels, sits against the centre line, in game pixels as well (`along` and `across` included). With a `hint`, the distance along it a step before (game pixels), the branch the point is on stays its branch (PRD 1923). */
export function locatePx(track: Pick<Track, 'centre'>, x: number, y: number, hint?: number): Located {
  const l = locate(track.centre, x / TILE, y / TILE, hint === undefined ? undefined : hint / TILE);
  return { along: l.along * TILE, across: l.across * TILE, dist: l.dist * TILE, x: l.x * TILE, y: l.y * TILE, tx: l.tx, ty: l.ty };
}

const crossed = new WeakMap<object, boolean>();

/** Whether the centre line crosses itself: only then does a kart carry the distance along the line it had a step before. */
export function crosses(track: Pick<Track, 'centre'>): boolean {
  const known = crossed.get(track.centre);
  if (known !== undefined) return known;
  const made = crossings(track.centre).length > 0;
  crossed.set(track.centre, made);
  return made;
}

/**
 * The kart `after` a step carries its distance along the line (PRD 1923): where it stands, read with the one `before` carried as its hint. On a circuit
 * whose line does not cross itself nothing is carried and `after` is returned as it is, so such a circuit answers exactly as it did.
 */
export function carryAlong<K extends { x: number; y: number; along?: number }>(track: Pick<Track, 'centre'>, before: { along?: number }, after: K): K {
  if (!crosses(track)) return after;
  const along = locatePx(track, after.x, after.y, before.along).along;
  return after.along === along ? after : { ...after, along };
}

/** The point of the centre line at a distance along it, in game pixels (it wraps around the closed line), with its tangent. */
export function pointAtPx(track: Pick<Track, 'centre'>, along: number): Sample {
  const p = pointAt(track.centre, along / TILE);
  return { x: p.x * TILE, y: p.y * TILE, along: p.along * TILE, tx: p.tx, ty: p.ty };
}

/** A corner of the circuit: the arc of the centre line that rounds a waypoint. */
export interface Corner {
  /** The waypoint's index in the racing line. */
  readonly index: number;
  /** The arc's radius, in tiles. */
  readonly radius: number;
  /** As seen from above, y down: a right turn is clockwise. */
  readonly turn: 'left' | 'right';
  /** Where the arc starts along the centre line, in tiles, and the unit tangent there. */
  readonly start: number;
  readonly into: readonly [number, number];
  /** The arc's length, in tiles. */
  readonly length: number;
}

/** The turn, in degrees, past which an arc is a corner. */
const CORNER_DEGREES = 30;

/** The arcs of the centre line that turn it by more than 30°, each with the way it turns. */
export function cornersOf(track: Pick<Track, 'centre'>): Corner[] {
  return track.centre.segments.flatMap((s) => {
    if (s.kind !== 'arc' || (s.len / s.r) * 180 / Math.PI <= CORNER_DEGREES) return [];
    const into = pointAt(track.centre, s.start);
    return [{ index: s.corner, radius: s.r, turn: s.dir === 1 ? 'right' as const : 'left' as const, start: s.start, into: [into.tx, into.ty] as const, length: s.len }];
  });
}

/** The tile of the first void beyond each end of the start line, walking out along it. */
function archLegs(g: Ground, line: StartLine): [[number, number], [number, number]] {
  const { k, first, last } = lineEnds(line);
  const out = (from: [number, number], step: 1 | -1): [number, number] => {
    let [x, y] = from;
    while (roadAt(g, (x + 0.5) * TILE, (y + 0.5) * TILE)) { if (k === 1) y += step; else x += step; }
    return [x, y];
  };
  return [out(first, -1), out(last, 1)];
}

/** The circuit as the game uses it; throws, naming the problems, when `trackProblems` finds any. */
export function parseTrack(src: TrackSource = COMET_RING): Track {
  const problems = trackProblems(src);
  if (problems.length) throw new Error(`the circuit is not drivable: ${problems.join('; ')}`);
  const b = bakedOf(src);
  const ground = groundFor(src, b);
  const line = defined(lineOf(src), 'the start line');
  const across = line.axis === 'column' ? 0 : 1;
  const lineAt = at(line.tiles, 0, 'the line')[across];
  // Nearest the line first, then across the road in reading order.
  const places = tilesOf(src.rows, 'S')
    .sort((a, b2) => Math.abs(a[across] - lineAt) - Math.abs(b2[across] - lineAt) || (across === 0 ? a[1] - b2[1] : a[0] - b2[0]))
    .map(centre);
  const legs = archLegs(ground, line);
  const cols = src.rows[0]?.length ?? 0;
  const start = lineCentre(line.tiles, line.forward);
  const gates = gatesOf(b.line).map((gt): Gate => ({
    index: gt.index, x: gt.x * TILE, y: gt.y * TILE, along: gt.along * TILE, tx: gt.tx, ty: gt.ty,
    ax: gt.ax * TILE, ay: gt.ay * TILE, bx: gt.bx * TILE, by: gt.by * TILE,
  }));
  return {
    cols, rows: src.rows.length, ...ground, centre: b.line, span: b.span, gates, length: b.line.length * TILE,
    startAlong: locate(b.line, start.x / TILE, start.y / TILE).along * TILE,
    waypoints: src.waypoints.map(centre), forward: line.forward, heading: Math.atan2(line.forward[1], line.forward[0]),
    places, boxes: tilesOf(src.rows, '?').map(centre), line: start,
    relief: src.relief ?? { heights: src.waypoints.map(() => 0), bumps: src.waypoints.map(() => 0) },
    props: (src.props ?? []).map(({ kind, x, y }) => ({ kind, ...centre([x, y]) })),
    arch: [centre(legs[0]), centre(legs[1])],
    stands: (src.stands ?? []).map(centre),
    shortcuts: (src.shortcuts ?? []).map(({ leg, gate, skips }) => ({ from: toPx(leg[0]), to: toPx(leg[1]), gate: [toPx(gate[0]), toPx(gate[1])], skips })),
  };
}
