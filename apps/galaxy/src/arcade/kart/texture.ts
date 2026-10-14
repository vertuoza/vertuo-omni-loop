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
import { inSpan, locate, pieceAt, segmentAt } from './line';
import { cornersOf, FLOOR, pointAtPx, TILE, type Corner, type Track } from './track';

/** The colours the circuit is painted from: the road is the middle of a four-tone ramp. The floor's own, none equal to a theme token (ADR-0046). */
export const SURFACE = Object.freeze({
  road: '#6d7194', neonCyan: '#19e6ff', neonMagenta: '#ff2bd6',
  lineLight: '#f1f1f8', lineDark: '#14122e', chevron: '#ffe94d',
  deckTop: '#a3a8cf', deck: '#4b5080', deckDark: '#1a1b3b',
  // PRD 1775: the pad's cyan and its chevrons, the ramp's stripes, the station's plating, the walkway's grating.
  pad: '#0fb5d4', padChevron: '#e6fdff', rampYellow: '#ffd21f', rampBlack: '#0d0c1f',
  plate: '#8089b0', plateSeam: '#3a4068', plateRivet: '#c9cfee', grating: '#12102a', gratingBar: '#33376a',
});

/** FROST EIGHT's colours (PRD 1923): powder, ice, asphalt, snow banks and red-and-white kerbs. The floor's own, none equal to a theme token (ADR-0046). */
export const FROST_SURFACE = Object.freeze({
  powder: '#e6eef6', powderShade: '#c9d9e8', powderLight: '#fbfdff',
  bank: '#ffffff', bankShade: '#b7cade',
  ice: '#8ecfe9', iceDeep: '#5aaed3', iceCrack: '#dcf4fc',
  asphalt: '#575b69', kerbRed: '#d6302f', kerbWhite: '#f8f8f8',
});

/** The void's pixel: see-through, so the floor has none there and the space behind it shows. */
export const VOID = 0;


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

const startAt = (px: number, py: number, grain: number, t: Tones): number => {
  if (px === 0 || py === 0 || px === TILE - 1 || py === TILE - 1) return t[0];
  return grain < 0.1 ? t[2] : t[1];
};
const grainAt = (grain: number, t: Tones): number => (grain < 0.08 ? t[2] : grain > 0.96 ? t[0] : t[1]);

/** The void pixels joined to the map's border through void, a gap closing the way as the road does: the outside of the circuit. One byte per pixel, 1 when outside. */
function outsideVoid({ size, road, gap }: Pick<Track, 'size' | 'road' | 'gap'>): Uint8Array {
  const { w, h } = size;
  const out = new Uint8Array(w * h);
  const todo = new Int32Array(w * h);
  let top = 0;
  const take = (x: number, y: number) => {
    const i = y * w + x;
    if (x < 0 || y < 0 || x >= w || y >= h || out[i] === 1 || road[i] === 1 || gap?.[i] === 1) return;
    out[i] = 1;
    todo[top++] = i;
  };
  for (let x = 0; x < w; x++) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y++) { take(0, y); take(w - 1, y); }
  while (top > 0) {
    const i = todo[--top] ?? 0;
    const x = i % w, y = (i - x) / w;
    take(x + 1, y); take(x - 1, y); take(x, y + 1); take(x, y - 1);
  }
  return out;
}

/** The pixels around one that make its neon edge: its eight neighbours, and two off along an axis. */
const EDGE_AROUND: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];

/** Whether one of the pixels around x, y (its neon edge) is road (`wantRoad`) or not road (past the map's edge included). */
function edgeHas({ size, road }: Pick<Track, 'size' | 'road'>, x: number, y: number, wantRoad: boolean): boolean {
  return EDGE_AROUND.some(([dx, dy]) => {
    const px = x + dx, py = y + dy;
    const onRoad = px >= 0 && py >= 0 && px < size.w && py < size.h && road[py * size.w + px] === 1;
    return onRoad === wantRoad;
  });
}

interface Where { px: number; py: number }
interface Ctx {
  ramps: Ramps;
  /** The way of the race through the tile being painted. */
  step: readonly [number, number];
}

const kerbAt = (along: number, frost = false): number => {
  const even = (Math.floor(along / 4) % 2 + 2) % 2 === 0;
  return pack(frost ? (even ? FROST_SURFACE.kerbRed : FROST_SURFACE.kerbWhite) : even ? SURFACE.neonCyan : SURFACE.neonMagenta);
};
const lineAt = (px: number, py: number): number => pack(((px >> 2) + (py >> 2)) % 2 === 0 ? SURFACE.lineLight : SURFACE.lineDark);

/** A pad's pixel: cyan, with a chevron pointing the way of the race. */
function padAt({ px, py }: Where, ctx: Ctx): number {
  return pack(onChevron(px - (TILE - 1) / 2, py - (TILE - 1) / 2, ctx.step) ? SURFACE.padChevron : SURFACE.pad);
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

/** A walkway's pixel: a dark grating, magenta where it meets the void. */
function gratingAt({ px, py }: Where, edge: boolean): number {
  if (edge) return pack(SURFACE.neonMagenta);
  return pack((px % 4 === 0 || py % 4 === 0) ? SURFACE.gratingBar : SURFACE.grating);
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

/** Whether the point `cx`, `cy` from a chevron's middle is on a chevron `►` pointing along `to` (a unit vector), its arms trailing back. */
function onChevron(cx: number, cy: number, to: readonly [number, number]): boolean {
  const u = cx * to[0] + cy * to[1];             // along the arrow
  const v = Math.abs(cx * -to[1] + cy * to[0]);  // across it
  const back = 4 - v - u;
  return v <= 6 && back >= 0 && back < 3;
}

/** How many tiles before a corner's arc its chevrons stand: the last one this far, then the two before it. */
const CHEVRON_FROM = 1.5;
const CHEVRONS = 3;

/** The way a corner's chevrons point: the leg into it, turned a quarter to the side the line turns. */
const pointing = (corner: Corner): [number, number] => {
  const [ix, iy] = corner.into;
  return corner.turn === 'right' ? [-iy, ix] : [iy, -ix];
};

/** One chevron stamped on the road around the point `x`, `y` (in game pixels), pointing along `to`. */
function stamp(track: Track, px: Uint32Array, at: { x: number; y: number }, to: readonly [number, number]): void {
  const w = track.size.w, colour = pack(SURFACE.chevron);
  for (let y = Math.floor(at.y - TILE / 2); y < at.y + TILE / 2; y++) {
    for (let x = Math.floor(at.x - TILE / 2); x < at.x + TILE / 2; x++) {
      if (x < 0 || y < 0 || x >= w || y >= track.size.h || track.road[y * w + x] !== 1) continue;
      if (onChevron(x + 0.5 - at.x, y + 0.5 - at.y, to)) px[y * w + x] = colour;
    }
  }
}

/** The three chevrons before every corner, on the straight into its arc, pointing the way it turns. */
function paintChevrons(track: Track, px: Uint32Array): void {
  for (const corner of cornersOf(track)) {
    for (let k = 0; k < CHEVRONS; k++) {
      stamp(track, px, pointAtPx(track, (corner.start - CHEVRON_FROM - k) * TILE), pointing(corner));
    }
  }
}

/** How far from the tunnel's span the road is still station plating, in tiles. */
const PLATING = 3;

/** The way of the race through a tile of the circuit: the direction of the piece it is on, or the centre line's tangent there. */
function stepOf(track: Track, tx: number, ty: number): [number, number] {
  const x = (tx + 0.5), y = (ty + 0.5);
  const piece = track.centre.pieces.find((p) => {
    const dx = p.to.x - p.from.x, dy = p.to.y - p.from.y, len = Math.hypot(dx, dy);
    const along = ((x - p.from.x) * dx + (y - p.from.y) * dy) / len, across = Math.abs((x - p.from.x) * -dy + (y - p.from.y) * dx) / len;
    return along >= 0 && along <= len && across <= p.width / 2;
  });
  if (piece && onlyPiece(track, x, y)) {
    const dx = piece.to.x - piece.from.x, dy = piece.to.y - piece.from.y, len = Math.hypot(dx, dy);
    return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx / len), 0] : [0, Math.sign(dy / len)];
  }
  const l = locate(track.centre, x, y);
  return Math.abs(l.tx) >= Math.abs(l.ty) ? [Math.sign(l.tx), 0] : [0, Math.sign(l.ty)];
}

/** Whether the point `x`, `y` (tile units) is road of a piece alone: more than half the road's width from the centre line. */
const onlyPiece = (track: Pick<Track, 'centre'>, x: number, y: number): boolean => locate(track.centre, x, y).dist > track.centre.width / 2;

/** The yellow arrows on the two road tiles before each ramp, pointing the way of the race. */
function paintArrows(track: Track, px: Uint32Array): void {
  for (let ty = 0; ty < track.rows; ty++) {
    for (let tx = 0; tx < track.cols; tx++) {
      if (track.map[ty]?.[tx] !== '^') continue;
      const to = stepOf(track, tx, ty);
      for (const k of [1, 2]) {
        const tile: [number, number] = [tx - to[0] * k, ty - to[1] * k];
        const c = track.map[tile[1]]?.[tile[0]];
        if (c === '.' ) stamp(track, px, { x: (tile[0] + 0.5) * TILE, y: (tile[1] + 0.5) * TILE }, to);
      }
    }
  }
}

const painted = new WeakMap<Uint8Array, Texture>();

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** What one pass over the pixels reads: the circuit, its road's tones, and the way of the race through the tile being painted. */
interface Paint { track: Track; ramps: Ramps; ctx: Ctx; plate: (along: number) => boolean; frost: boolean }

/** A road pixel of a piece alone (further from the centre line than half its width): a walkway's grating, magenta where it meets the void; the spur is road like the rest. */
function pieceRoadAt(p: Paint, x: number, y: number, where: Where, grain: number): number {
  const { track, ramps } = p;
  const grating = track.centre.pieces.some((piece) => piece.surface === 'grating' && pieceAt(track.centre, (x + 0.5) / TILE, (y + 0.5) / TILE) === piece);
  if (grating) return gratingAt(where, edgeHas(track, x, y, false));
  return grainAt(grain, ramps.road);
}

/** A road pixel of the centre line's own road: the kerb on a round edge, plating by the tunnel, a seam across the way forward, else the road's grain. */
function lineRoadAt(p: Paint, at: ReturnType<typeof locate>, where: Where, grain: number): number {
  const { track, ramps } = p;
  const alongPx = at.along * TILE;
  if (segmentAt(track.centre, at.along).kind === 'arc' && at.dist > track.centre.width / 2 - 0.5) return kerbAt(alongPx, p.frost);
  if (p.plate(at.along)) return plateAt(where);
  return mod(alongPx, 4 * TILE) < 1 ? ramps.road[3] : grainAt(grain, ramps.road);
}

/** The pixel x, y of the road, by the tile of the map's features it is on, else by where it sits against the centre line. */
function roadPixelAt(p: Paint, x: number, y: number, grain: number): number {
  const { track, ramps, ctx } = p;
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), where: Where = { px: x - tx * TILE, py: y - ty * TILE };
  const c = track.map[ty]?.[tx] ?? '.';
  if (c === '=') return lineAt(where.px, where.py);
  if (c === 'S') return startAt(where.px, where.py, grain, ramps.road);
  if (c === '^') return rampAt(where);
  if (c === '+') {
    ctx.step = stepOf(track, tx, ty);
    return padAt(where, ctx);
  }
  const at = locate(track.centre, (x + 0.5) / TILE, (y + 0.5) / TILE);
  return at.dist > track.centre.width / 2 ? pieceRoadAt(p, x, y, where, grain) : lineRoadAt(p, at, where, grain);
}

/** Whether a pixel within `reach` of x, y along an axis or a diagonal is road. */
function roadWithin({ size, road }: Pick<Track, 'size' | 'road'>, x: number, y: number, reach: number): boolean {
  const d = Math.max(1, Math.round(reach * 0.7));
  return ([[reach, 0], [-reach, 0], [0, reach], [0, -reach], [d, d], [-d, d], [d, -d], [-d, -d]] as const).some(([dx, dy]) => {
    const px = x + dx, py = y + dy;
    return px >= 0 && py >= 0 && px < size.w && py < size.h && road[py * size.w + px] === 1;
  });
}

/** An ice pixel: the lake's blue, a few deeper flecks and thin pale cracks. */
function iceAt(x: number, y: number, grain: number): number {
  if ((x * 3 + y * 5) % 67 === 0 || (x * 5 - y * 2 + 4000) % 53 === 0) return pack(FROST_SURFACE.iceCrack);
  return pack(grain < 0.07 ? FROST_SURFACE.iceDeep : FROST_SURFACE.ice);
}

/** A powder pixel: the snow bank against the road's edge, white and then shaded one step further out, else powder with its grain. */
function powderAt(track: Track, x: number, y: number, grain: number): number {
  if (roadWithin(track, x, y, 1)) return pack(FROST_SURFACE.bank);
  if (roadWithin(track, x, y, 3)) return pack(FROST_SURFACE.bankShade);
  return pack(grain < 0.08 ? FROST_SURFACE.powderShade : grain > 0.95 ? FROST_SURFACE.powderLight : FROST_SURFACE.powder);
}

/** The pixel x, y of the circuit: by its floor on a circuit that has one (ice, road, powder), else the road, the neon edge of the road on the void, or the void. */
function pixelAt(p: Paint, outside: Uint8Array, x: number, y: number, grain: number): number {
  const { track } = p, i = y * track.size.w + x;
  if (track.floor) {
    const code = track.floor[i];
    return code === FLOOR.ice ? iceAt(x, y, grain) : code === FLOOR.road ? roadPixelAt(p, x, y, grain) : powderAt(track, x, y, grain);
  }
  if (track.road[i] === 1) return roadPixelAt(p, x, y, grain);
  return edgeHas(track, x, y, true) ? pack(outside[i] === 1 ? SURFACE.neonCyan : SURFACE.neonMagenta) : VOID;
}

/** The circuit painted: `cols × 16` by `rows × 16` pixels, every pixel read from the centre line and the features' tiles. */
export function paintTrack(track: Track): Texture {
  const known = painted.get(track.road);
  if (known) return known;
  const { w, h } = track.size;
  const px = new Uint32Array(w * h);
  const { span } = track;
  const p: Paint = {
    track, ramps: { road: tones(track.floor ? FROST_SURFACE.asphalt : SURFACE.road) }, ctx: { ramps: { road: tones(SURFACE.road) }, step: [1, 0] }, frost: track.floor !== undefined,
    plate: (along) => span !== null && inSpan(track.centre, { start: span.start - PLATING, length: span.length + 2 * PLATING }, along),
  };
  const outside = track.floor ? new Uint8Array(0) : outsideVoid(track);
  const rand = rng(1359);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const grain = rand();
      px[i] = pixelAt(p, outside, x, y, grain);
    }
  }
  paintChevrons(track, px);
  paintArrows(track, px);
  const texture = { w, h, px };
  painted.set(track.road, texture);
  return texture;
}
