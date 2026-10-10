// COMET RING's floor texture (PRD 1359): the circuit's map painted once, one tile = 16×16 pixels, from
// `@omni/design` ramps (`rampFrom`), as packed pixels. Pure: no canvas, so it is tested and reused as
// it is. The Mode 7 floor samples it (mode7.ts).
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { rampFrom, rng } from '@omni/design';
import type { Texture } from './mode7';
import { TILE, tileAt, type Track } from './track';

/** The colours the circuit is painted from, each one the middle of a four-tone ramp. */
export const SURFACE = Object.freeze({
  road: '#6d7194', grass: '#2e9d4f', wall: '#3b3466', kerbRed: '#e63946', kerbWhite: '#f1f1f8', lineDark: '#14122e',
});

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

const grassAt = (px: number, py: number, grain: number, t: Tones): number => {
  const dim = grain < 0.12;
  return ((px >> 2) + (py >> 2)) & 1 ? (dim ? t[0] : t[1]) : (dim ? t[1] : t[2]);
};
const wallAt = (px: number, py: number, t: Tones): number => {
  if (py % 8 === 0 || (px + (py >> 3) * 4) % 8 === 0) return t[3];
  return py % 8 === 1 ? t[0] : t[1];
};
const startAt = (px: number, py: number, grain: number, t: Tones): number => {
  if (px === 0 || py === 0 || px === TILE - 1 || py === TILE - 1) return t[0];
  return grain < 0.1 ? t[2] : t[1];
};
const roadAt = (grain: number, t: Tones): number => (grain < 0.08 ? t[2] : grain > 0.96 ? t[0] : t[1]);

/** The colour of the pixel at px, py inside a tile of kind `c`, seeded by the tile's place so the grain is the same every time. */
function paint(c: string, px: number, py: number, grain: number, ramps: { road: Tones; grass: Tones; wall: Tones }): number {
  switch (c) {
    case '.': return grassAt(px, py, grain, ramps.grass);
    case 'X': return wallAt(px, py, ramps.wall);
    case 'r': return pack((px >> 2) % 2 === 0 ? SURFACE.kerbRed : SURFACE.kerbWhite);
    case '=': return pack(((px >> 2) + (py >> 2)) % 2 === 0 ? SURFACE.kerbWhite : SURFACE.lineDark);
    case 'S': return startAt(px, py, grain, ramps.road);
    default: return roadAt(grain, ramps.road); // '#' and '?': road
  }
}

/** The texture's colour past the map's edge: the wall's. */
export const BEYOND = pack(SURFACE.wall);

/** The circuit painted: `cols × 16` by `rows × 16` pixels. */
export function paintTrack(track: Pick<Track, 'cols' | 'rows' | 'map'>): Texture {
  const w = track.cols * TILE, h = track.rows * TILE;
  const px = new Uint32Array(w * h);
  const ramps = { road: tones(SURFACE.road), grass: tones(SURFACE.grass), wall: tones(SURFACE.wall) };
  const rand = rng(1359);
  for (let ty = 0; ty < track.rows; ty++) {
    for (let tx = 0; tx < track.cols; tx++) {
      const c = tileAt(track.map, tx, ty);
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) px[(ty * TILE + y) * w + tx * TILE + x] = paint(c, x, y, rand(), ramps);
      }
    }
  }
  return { w, h, px };
}
