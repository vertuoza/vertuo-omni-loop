// COMET RING's floor texture (PRD 1359, dressed as a space circuit by PRD 1427): the circuit's map painted
// once, one tile = 16×16 pixels, from `@omni/design` ramps (`rampFrom`), as packed pixels. Dark metal
// neon kerbs, panel seams across the road, and three chevrons
// before each corner. Everything off the road is the void (PRD 1447): no floor at all, see-through so the
// space drawn behind the floor shows (art.ts), with a neon edge on its side of the road's edge. Pure: no
// canvas, so it is tested and reused as it is. The Mode 7 floor samples
// it (mode7.ts). Only the map's characters decide what a tile is, never a colour.
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { rampFrom, rng } from '@omni/design';
import type { Deck, Texture } from './mode7';
import { cornersOf, isRoad, TILE, tileAt, type Corner, type Track } from './track';

/** The colours the circuit is painted from: the road is the middle of a four-tone ramp. The floor's own, none equal to a theme token (ADR-0046). */
export const SURFACE = Object.freeze({
  road: '#6d7194', neonCyan: '#19e6ff', neonMagenta: '#ff2bd6',
  lineLight: '#f1f1f8', lineDark: '#14122e', chevron: '#ffe94d',
  deckTop: '#a3a8cf', deck: '#4b5080', deckDark: '#1a1b3b',
  // PRD 1775: the pad's cyan and its chevrons, the ramp's stripes, the station's plating, the walkway's grating.
  pad: '#0fb5d4', padChevron: '#e6fdff', rampYellow: '#ffd21f', rampBlack: '#0d0c1f',
  plate: '#8089b0', plateSeam: '#3a4068', plateRivet: '#c9cfee', grating: '#12102a', gratingBar: '#33376a',
});

/** The void's pixel: see-through, so the floor has none there and the space behind it shows. */
export const VOID = 0;

/** The neon edge's width in pixels. */
const EDGE = 2;
/** How many tiles before a corner its chevrons stand: the last one this far, then the two before it. */
const CHEVRON_FROM = 2;
const CHEVRONS = 3;

/** A `#rrggbb` colour packed as a canvas's little-endian pixel holds it. */
export function pack(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
}

/** A ramp's four tones, packed: light, base, shade, dark. */
function tones(hex: string): [number, number, number, number] {
  const r = rampFrom(hex);
  return [pack(at(r, 0, 'a light tone')), pack(at(r, 1, 'a base tone')), pack(at(r, 2, 'a shade tone')), pack(at(r, 3, 'a dark tone'))];
}

type Tones = ReturnType<typeof tones>;
type Ramps = { road: Tones };
type FloorMap = Pick<Track, 'cols' | 'rows' | 'map'>;

const startAt = (px: number, py: number, grain: number, t: Tones): number => {
  if (px === 0 || py === 0 || px === TILE - 1 || py === TILE - 1) return t[0];
  return grain < 0.1 ? t[2] : t[1];
};
const roadAt = (grain: number, t: Tones): number => (grain < 0.08 ? t[2] : grain > 0.96 ? t[0] : t[1]);

/** How many void tiles lie from the ramp at tx, ty in the direction dx, dy before road follows them (at most 8), 0 when none or when no road follows. */
function gapAhead(map: readonly string[], tx: number, ty: number, [dx, dy]: readonly [number, number]): number {
  let n = 1;
  while (n <= 8 && tileAt(map, tx + dx * n, ty + dy * n) === '~') n++;
  return n > 1 && isRoad(tileAt(map, tx + dx * n, ty + dy * n)) ? n - 1 : 0;
}

/** The void tiles of the gaps (PRD 1775): a run of void that a ramp leads into and road follows. A kart flies over one, so it closes the circuit's inside as the road does. One byte per tile, 1 in a gap. */
function gapsOf({ cols, rows, map }: FloorMap): Uint8Array {
  const gap = new Uint8Array(cols * rows);
  const ramps = map.flatMap((row, ty) => Array.from(row).flatMap((c, tx) => (c === '^' ? [[tx, ty] as const] : [])));
  for (const [tx, ty] of ramps) {
    for (const step of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      for (let k = 1; k <= gapAhead(map, tx, ty, step); k++) gap[(ty + step[1] * k) * cols + tx + step[0] * k] = 1;
    }
  }
  return gap;
}

/** The void tiles joined to the map's border through void, a gap closing the way as the road does: the outside of the circuit. One byte per tile, 1 when outside. */
function outsideVoid({ cols, rows, map }: FloorMap): Uint8Array {
  const out = new Uint8Array(cols * rows);
  const gaps = gapsOf({ cols, rows, map });
  const todo: [number, number][] = [];
  const take = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows || out[y * cols + x] || gaps[y * cols + x] || tileAt(map, x, y) !== '~') return;
    out[y * cols + x] = 1;
    todo.push([x, y]);
  };
  for (let x = 0; x < cols; x++) { take(x, 0); take(x, rows - 1); }
  for (let y = 0; y < rows; y++) { take(0, y); take(cols - 1, y); }
  for (let next = todo.pop(); next; next = todo.pop()) {
    take(next[0] + 1, next[1]); take(next[0] - 1, next[1]); take(next[0], next[1] + 1); take(next[0], next[1] - 1);
  }
  return out;
}

/** Whether a pixel of a void tile is on a side that meets the road, within the neon edge. */
function onEdge(map: readonly string[], tx: number, ty: number, px: number, py: number): boolean {
  return (px < EDGE && isRoad(tileAt(map, tx - 1, ty))) || (px >= TILE - EDGE && isRoad(tileAt(map, tx + 1, ty)))
    || (py < EDGE && isRoad(tileAt(map, tx, ty - 1))) || (py >= TILE - EDGE && isRoad(tileAt(map, tx, ty + 1)));
}

/** The way forward through a tile: the unit step along the nearest leg of the racing line, in the direction of the race. */
function travelStep(waypoints: Track['waypoints'], tx: number, ty: number): [number, number] {
  const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
  let step: [number, number] = [1, 0], nearest = Infinity;
  waypoints.forEach((a, i) => {
    const b = at(waypoints, (i + 1) % waypoints.length, 'the next waypoint');
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((cx - a.x) * dx + (cy - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = (a.x + t * dx - cx) ** 2 + (a.y + t * dy - cy) ** 2;
    if (d < nearest) { nearest = d; step = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; }
  });
  return step;
}

/** The axis the way forward runs along: 'x' east or west, 'y' north or south. */
const travelAxis = (waypoints: Track['waypoints'], tx: number, ty: number): 'x' | 'y' => (travelStep(waypoints, tx, ty)[0] === 0 ? 'y' : 'x');

interface Where { tx: number; ty: number; px: number; py: number }
interface Ctx {
  map: readonly string[]; ramps: Ramps; neon: number; seam: boolean;
  /** The way of the race through the tile being painted. */
  step: readonly [number, number];
  /** Whether the tile is station plating: roofed road, or road within three tiles of it. */
  plated: boolean;
}

const kerbAt = (px: number): number => pack((px >> 2) % 2 === 0 ? SURFACE.neonCyan : SURFACE.neonMagenta);
const lineAt = (px: number, py: number): number => pack(((px >> 2) + (py >> 2)) % 2 === 0 ? SURFACE.lineLight : SURFACE.lineDark);

/** A pad's pixel: cyan, with a chevron pointing the way of the race. */
function padAt({ px, py }: Where, ctx: Ctx): number {
  return pack(onChevron(px, py, ctx.step) ? SURFACE.padChevron : SURFACE.pad);
}

/** A ramp's pixel: yellow and black diagonal stripes. */
function rampAt({ px, py }: Where): number {
  return pack(((px + py) >> 2) % 2 === 0 ? SURFACE.rampYellow : SURFACE.rampBlack);
}

/** Station plating: metal panels 8 pixels square, seams between them, a rivet in each corner. */
function plateAt({ px, py }: Where): number {
  if (px % 8 === 0 || py % 8 === 0) return pack(SURFACE.plateSeam);
  return pack((px % 8 === 1 || px % 8 === 7) && (py % 8 === 1 || py % 8 === 7) ? SURFACE.plateRivet : SURFACE.plate);
}

/** Whether a pixel of a walkway tile is on a side that meets the void, within the neon edge. */
function onVoidEdge(map: readonly string[], { tx, ty, px, py }: Where): boolean {
  const gone = (x: number, y: number) => tileAt(map, x, y) === '~';
  return (px < EDGE && gone(tx - 1, ty)) || (px >= TILE - EDGE && gone(tx + 1, ty)) || (py < EDGE && gone(tx, ty - 1)) || (py >= TILE - EDGE && gone(tx, ty + 1));
}

/** A walkway's pixel: a dark grating, magenta where it meets the void. */
function gratingAt(w: Where, ctx: Ctx): number {
  if (onVoidEdge(ctx.map, w)) return pack(SURFACE.neonMagenta);
  return pack((w.px % 4 === 0 || w.py % 4 === 0) ? SURFACE.gratingBar : SURFACE.grating);
}

/** A void tile's pixel: neon where a side meets the road, else nothing. */
function edged({ tx, ty, px, py }: Where, ctx: Ctx): number {
  return onEdge(ctx.map, tx, ty, px, py) ? ctx.neon : VOID;
}

/** How each kind of tile with a look of its own paints a pixel; the road (`#` and `?`) is the rest. */
const PAINTERS: Readonly<Record<string, (w: Where, grain: number, ctx: Ctx) => number>> = {
  '~': (w, _g, ctx) => edged(w, ctx),
  r: (w) => kerbAt(w.px),
  '=': (w) => lineAt(w.px, w.py),
  S: (w, g, ctx) => startAt(w.px, w.py, g, ctx.ramps.road),
  '+': (w, _g, ctx) => padAt(w, ctx),
  '^': rampAt,
  w: (w, _g, ctx) => gratingAt(w, ctx),
  T: plateAt,
};

/** A road pixel: plating near a tunnel, else the road's grain, darker on a seam. */
function roadPixel(w: Where, grain: number, ctx: Ctx): number {
  if (ctx.plated) return plateAt(w);
  return ctx.seam ? ctx.ramps.road[3] : roadAt(grain, ctx.ramps.road);
}

/** The colour of the pixel at px, py inside the tile tx, ty of kind `c`, seeded by the tile's place so the grain is the same every time. */
function paint(c: string, w: Where, grain: number, ctx: Ctx): number {
  return (PAINTERS[c] ?? roadPixel)(w, grain, ctx);
}

/** A `#rrggbb` colour `t` of the way from `a` to `b`, packed, with the opacity `alpha` (0 to 1). */
function blend(a: string, b: string, t: number, alpha = 1): number {
  const x = Number.parseInt(a.slice(1), 16), y = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((x >> shift) & 0xff) * (1 - t) + ((y >> shift) & 0xff) * t);
  return ((Math.round(alpha * 255) << 24) | (ch(0) << 16) | (ch(8) << 8) | ch(16)) >>> 0;
}

/** How deep the side of the road's deck is under its edge, and its glow under that, in world units (PRD 1698). */
export const DECK_DEPTH = 12;
export const DECK_GLOW = 18;

/**
 * The side of the road's deck over the void (mode7.ts): a light lip under the edge, metal shading darker down the
 * side, every other panel a shade darker still, a magenta neon line along its foot, and a magenta glow fading away
 * under it, so the circuit reads as a thick deck floating in space, never a sheet.
 */
export function deckOf(): Deck {
  const LEVELS = 10;
  const shade = (dark: number) => Uint32Array.from({ length: LEVELS }, (_, i) => {
    if (i === 0) return blend(SURFACE.deckTop, SURFACE.deckDark, dark);
    if (i === LEVELS - 1) return pack(SURFACE.neonMagenta);
    return blend(SURFACE.deck, SURFACE.deckDark, Math.min(1, ((i - 1) / (LEVELS - 3)) * 0.85 + dark));
  });
  const glowPx = Uint32Array.from({ length: 6 }, (_, i) => blend(SURFACE.neonMagenta, SURFACE.neonMagenta, 0, 0.5 * (1 - i / 6)));
  return { thickness: DECK_DEPTH, wall: shade(0), stripe: shade(0.15), glow: DECK_GLOW, glowPx };
}

/** The texture's colour past the map's edge: the void, see-through too. */
export const BEYOND = VOID;

/** Whether the pixel x, y of a tile is on a chevron `►` pointing along `to` (a unit step), its arms trailing back. */
function onChevron(x: number, y: number, to: readonly [number, number]): boolean {
  const cx = x - (TILE - 1) / 2, cy = y - (TILE - 1) / 2;
  const u = cx * to[0] + cy * to[1];             // along the arrow
  const v = Math.abs(cx * -to[1] + cy * to[0]);  // across it
  const back = 4 - v - u;
  return v <= 6 && back >= 0 && back < 3;
}

/** The road tiles that carry a corner's chevrons: along the leg into it, the last one two tiles before it. */
function chevronTiles(corner: Corner, map: readonly string[]): [number, number][] {
  const [ix, iy] = corner.into;
  const out: [number, number][] = [];
  for (let k = CHEVRON_FROM; k < CHEVRON_FROM + CHEVRONS; k++) out.push([corner.x - ix * k, corner.y - iy * k]);
  return out.filter(([tx, ty]) => tileAt(map, tx, ty) === '#');
}

/** The way a corner's chevrons point: the leg into it, turned a quarter to the side the line turns. */
const pointing = (corner: Corner): [number, number] => {
  const [ix, iy] = corner.into;
  return corner.turn === 'right' ? [-iy, ix] : [iy, -ix];
};

/** One chevron stamped on the tile tx, ty. */
function stamp(px: Uint32Array, w: number, tile: readonly [number, number], to: readonly [number, number]): void {
  const colour = pack(SURFACE.chevron);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) if (onChevron(x, y, to)) px[(tile[1] * TILE + y) * w + tile[0] * TILE + x] = colour;
  }
}

/** The three chevrons before every corner, pointing the way it turns. */
function paintChevrons(track: Pick<Track, 'map' | 'waypoints'>, px: Uint32Array, w: number): void {
  for (const corner of cornersOf(track)) {
    for (const tile of chevronTiles(corner, track.map)) stamp(px, w, tile, pointing(corner));
  }
}

/** How far from a roofed tile the road is still station plating, in tiles. */
const PLATING = 3;

/** Whether a roofed tile is within `PLATING` tiles of the tile tx, ty, in either direction. */
function nearRoof(map: readonly string[], tx: number, ty: number): boolean {
  for (let dy = -PLATING; dy <= PLATING; dy++) {
    for (let dx = -PLATING; dx <= PLATING; dx++) if (tileAt(map, tx + dx, ty + dy) === 'T') return true;
  }
  return false;
}

/** The ramp tiles' road tiles two steps back: the two tiles before each ramp, along the race, that carry a yellow arrow. */
function arrowTiles(track: Pick<Track, 'cols' | 'rows' | 'map' | 'waypoints'>): { tile: [number, number]; to: [number, number] }[] {
  const out: { tile: [number, number]; to: [number, number] }[] = [];
  for (let ty = 0; ty < track.rows; ty++) {
    for (let tx = 0; tx < track.cols; tx++) {
      if (tileAt(track.map, tx, ty) !== '^') continue;
      const to = travelStep(track.waypoints, tx, ty);
      for (const k of [1, 2]) {
        const tile: [number, number] = [tx - to[0] * k, ty - to[1] * k];
        if (tileAt(track.map, tile[0], tile[1]) === '#') out.push({ tile, to });
      }
    }
  }
  return out;
}

/** The yellow arrows on the two road tiles before each ramp, pointing the way of the race. */
function paintArrows(track: Pick<Track, 'cols' | 'rows' | 'map' | 'waypoints'>, px: Uint32Array, w: number): void {
  for (const { tile, to } of arrowTiles(track)) stamp(px, w, tile, to);
}

/** The axis whose tile coordinate carries a seam on this tile (every fourth tile along the way forward), or null for no seam. */
function seamAxis(c: string, waypoints: Track['waypoints'], tx: number, ty: number): 'x' | 'y' | null {
  if (c !== '#' && c !== '?') return null;
  const axis = travelAxis(waypoints, tx, ty);
  return (axis === 'x' ? tx : ty) % 4 === 0 ? axis : null;
}

/** One tile's 16×16 pixels, a seam being the tile's first pixel line across the way forward. */
function paintTile(px: Uint32Array, w: number, track: Pick<Track, 'map' | 'waypoints'>, where: { tx: number; ty: number }, ctx: Ctx, rand: () => number): void {
  const { tx, ty } = where;
  const c = tileAt(track.map, tx, ty);
  const seam = seamAxis(c, track.waypoints, tx, ty);
  ctx.step = travelStep(track.waypoints, tx, ty);
  ctx.plated = (c === '#' || c === '?') && nearRoof(track.map, tx, ty);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      ctx.seam = seam !== null && (seam === 'x' ? x : y) === 0;
      px[(ty * TILE + y) * w + tx * TILE + x] = paint(c, { tx, ty, px: x, py: y }, rand(), ctx);
    }
  }
}

/** The circuit painted: `cols × 16` by `rows × 16` pixels. */
export function paintTrack(track: Pick<Track, 'cols' | 'rows' | 'map' | 'waypoints'>): Texture {
  const w = track.cols * TILE, h = track.rows * TILE;
  const px = new Uint32Array(w * h);
  const ramps = { road: tones(SURFACE.road) };
  const outside = outsideVoid(track);
  const rand = rng(1359);
  for (let ty = 0; ty < track.rows; ty++) {
    for (let tx = 0; tx < track.cols; tx++) {
      const neon = pack(outside[ty * track.cols + tx] ? SURFACE.neonCyan : SURFACE.neonMagenta);
      paintTile(px, w, track, { tx, ty }, { map: track.map, ramps, neon, seam: false, step: [1, 0], plated: false }, rand);
    }
  }
  paintChevrons(track, px, w);
  paintArrows(track, px, w);
  return { w, h, px };
}
