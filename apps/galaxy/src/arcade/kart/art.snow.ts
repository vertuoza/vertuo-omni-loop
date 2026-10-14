// FROST EIGHT's look on the canvas (PRD 1923): the pale sky over snowy peaks with a low sun, the flakes that fall (and stand still under reduced
// motion), the pines, chalets, lift pylons, snowmen and signs on the powder, the stands beside the start straight, the wooden arch over the start,
// and the lake on the minimap. Everything here is drawn with fills, so a circuit that has a floor needs no sprite. art.ts draws COMET RING as ever
// and calls this for a circuit with a floor (`isSnow`).
import { rng } from '@omni/design';
import type { FrameState } from '../scenes/common.ts';
import { project, type Projected, type View } from './mode7';
import { groundAt } from './relief';
import { FLOOR, surfaceAt, TILE, type Track } from './track';

/** The colours of the circuit's sky, scenery and minimap. Its own, none equal to a theme token (ADR-0046). */
export const SNOW = Object.freeze({
  skyTop: '#8fbfe8', skyLow: '#f1f7fc', ground: '#e6eef6',
  sun: '#fff4c9', sunGlow: '#ffe7a0',
  peakFar: '#b9cbe0', peakNear: '#8ea6c3', cap: '#ffffff',
  flake: '#ffffff',
  pineDark: '#1d5a3b', pine: '#2c7a4c', pineSnow: '#f3f8fc', trunk: '#6a4a2e',
  wall: '#b98a55', wallDark: '#8c6238', roof: '#a8312d', roofSnow: '#fbfdff', window: '#ffe08a', door: '#5a3a22',
  pylon: '#4b505e', chair: '#d6302f', snowman: '#ffffff', snowmanShade: '#c8d8e8', carrot: '#f08a24', scarf: '#d6302f', coal: '#22242e',
  sign: '#f2c94c', signMark: '#2b2d3a', post: '#6a4a2e',
  wood: '#9c6c3c', woodDark: '#6e4725', banner: '#d6302f', bannerWhite: '#f8f8f8',
  lake: '#8fd3ee', lakeRoad: '#cdeefa',
});

/** Whether a circuit is FROST EIGHT's kind: it has a floor, so no void. */
export const isSnow = (track: Pick<Track, 'floor'>): boolean => track.floor !== undefined;

const hexOf = (c: string): number => Number.parseInt(c.slice(1), 16);
/** A `#rrggbb` colour `t` of the way from `a` to `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = hexOf(a), y = hexOf(b);
  const ch = (shift: number) => Math.round(((x >> shift) & 0xff) * (1 - t) + ((y >> shift) & 0xff) * t).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

const wrap = (x: number, span: number): number => ((x % span) + span) % span;

/** How many bands the sky is fading over, from its pale blue at the top to white at the horizon. */
const BANDS = 8;

/** The height of a ridge of the panorama at `u`, 0 to 1: a few sharp sines whose waves fit the panorama `period` whole, so it ends where it began. */
export function peakAt(seed: number, layer: 0 | 1, u: number, period: number): number {
  const ks = layer === 0 ? [5, 11, 23] : [7, 17, 31];
  const next = rng(seed + layer * 101);
  let sum = 0;
  ks.forEach((k, i) => { sum += Math.abs(Math.sin((2 * Math.PI * k * u) / period + next() * 6.28)) * (i === 0 ? 0.5 : i === 1 ? 0.3 : 0.2); });
  return sum;
}

/** A flake of the falling snow, at a screen pixel. */
export interface Flake { x: number; y: number; size: 1 | 2 }
export const FLAKES = 70;

/** The flakes at time `t` on a `w` × `h` screen: each falls at its own speed and sways a little; with motion reduced they stand still where they began. */
export function flakesOf(seed: number, t: number, w: number, h: number, reduced: boolean): Flake[] {
  const next = rng(seed ^ 0x666c6b);
  const at = reduced ? 0 : t;
  return Array.from({ length: FLAKES }, (_, i) => {
    const x0 = next() * w, y0 = next() * h, fall = 14 + next() * 22, sway = next() * 6, size = next() < 0.2 ? 2 : 1;
    return { x: Math.floor(wrap(x0 + Math.sin(at * 0.8 + i) * sway, w)), y: Math.floor(wrap(y0 + fall * at, h)), size: size === 2 ? 2 : 1 };
  });
}

/** The circuit's sky: pale blue fading to white, peaks along the horizon, a low sun, and powder under the horizon where the map ends. `shift` turns the panorama with the camera. */
export function snowSky(ctx: CanvasRenderingContext2D, v: View, shift: number, seed: number): void {
  const sky = v.horizon;
  const band = Math.ceil(sky / BANDS);
  for (let i = 0; i < BANDS; i++) { ctx.fillStyle = mix(SNOW.skyTop, SNOW.skyLow, i / (BANDS - 1)); ctx.fillRect(0, i * band, v.w, band + 1); }
  ctx.fillStyle = SNOW.ground;
  ctx.fillRect(0, sky, v.w, v.h - sky);
  // The sun hangs low over the peaks, in a glow of two rings.
  const sx = Math.round(wrap(shift * 0.6 + v.w * 0.7, v.w * 6) - v.w * 0.2), sy = Math.round(sky - sky * 0.22), r = Math.max(3, Math.round(sky * 0.1));
  ctx.fillStyle = SNOW.sunGlow;
  for (const [k, alpha] of [[2.6, 0.18], [1.7, 0.3]] as const) { ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(sx, sy, r * k, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = SNOW.sun;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  // Two ridges of peaks, the far one paler, each with a white cap.
  const period = v.w * 6;
  for (const layer of [0, 1] as const) {
    const top = sky * (layer === 0 ? 0.42 : 0.26), body = layer === 0 ? SNOW.peakFar : SNOW.peakNear, speed = layer === 0 ? 0.7 : 1;
    for (let x = 0; x < v.w; x += 2) {
      const h = Math.max(2, Math.round(peakAt(seed, layer, x + shift * speed + period, period) * top));
      const cap = Math.max(1, Math.round(h * 0.3));
      ctx.fillStyle = body; ctx.fillRect(x, sky - h, 2, h);
      ctx.fillStyle = SNOW.cap; ctx.fillRect(x, sky - h, 2, cap);
    }
  }
}

/** The flakes over the picture, one pixel each and a few two. */
export function snowfall(ctx: CanvasRenderingContext2D, s: Pick<FrameState, 't' | 'reduced'>, v: View, seed: number): void {
  ctx.fillStyle = SNOW.flake;
  for (const f of flakesOf(seed, s.t, v.w, v.h, s.reduced)) ctx.fillRect(f.x, f.y, f.size, f.size);
}

/** What stands on the powder: a kind and the pixel it stands at. */
export const SNOW_KINDS = ['pine', 'chalet', 'pylon', 'snowman', 'sign'] as const;
export type SnowKind = (typeof SNOW_KINDS)[number];
export interface SnowThing { kind: SnowKind; x: number; y: number }

/** How wide each kind stands in the world, and how high, in game pixels. */
const SNOW_SIZE: Readonly<Record<SnowKind, { w: number; h: number }>> = {
  pine: { w: 20, h: 34 }, chalet: { w: 40, h: 34 }, pylon: { w: 14, h: 40 }, snowman: { w: 12, h: 18 }, sign: { w: 10, h: 18 },
};

/** Whether every point within `tiles` of the tile centre `x`, `y` is powder inside the map: clear of the road, the lake and the map's edge. */
function onPowder(track: Track, x: number, y: number, tiles: number): boolean {
  const reach = tiles * TILE;
  for (let dy = -reach; dy <= reach; dy += TILE / 2) {
    for (let dx = -reach; dx <= reach; dx += TILE / 2) {
      if (surfaceAt(track, (x + 0.5) * TILE + dx, (y + 0.5) * TILE + dy) !== 'powder') return false;
    }
  }
  return true;
}

/** The stands beside the start straight, in tiles: on the snow inside the bottom loop. */
const STANDS: readonly (readonly [number, number])[] = [[32, 58], [36, 58], [40, 58], [44, 58], [48, 58]];
const FOREST = 150, CHALETS = 6, SNOWMEN = 6;

const made = new WeakMap<Uint8Array, { props: SnowThing[]; stands: { x: number; y: number }[] }>();

/** What FROST EIGHT stands on its powder, and its stands, at their tile centres in game pixels. Decided once per circuit from a fixed seed, never on the road, the lake or within a tile of them. */
export function snowScenery(track: Track): { props: SnowThing[]; stands: { x: number; y: number }[] } {
  const known = made.get(track.road);
  if (known) return known;
  const props: SnowThing[] = [];
  const centre = (x: number, y: number) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
  const free = (x: number, y: number, apart: number) => props.every((p) => Math.hypot(p.x / TILE - 0.5 - x, p.y / TILE - 0.5 - y) >= apart);
  const put = (kind: SnowKind, x: number, y: number, clear: number, apart = 1.8): boolean => {
    if (x < 1 || y < 1 || x > track.cols - 2 || y > track.rows - 2 || !onPowder(track, x, y, clear) || !free(x, y, apart)) return false;
    props.push({ kind, ...centre(x, y) });
    return true;
  };
  // The tree line along the map's edge, two rows deep.
  for (let t = 2; t < track.cols - 1; t += 2) {
    const k = (t / 2) % 2;
    for (const [x, y] of [[t, 1 + k], [t, track.rows - 2 - k], [1 + k, t], [track.cols - 2 - k, t]] as const) put('pine', x, y, 1, 1);
  }
  // A line of lift pylons up the west side, a sign outside each corner of the circuit.
  for (let y = 12; y < track.rows - 8; y += 6) put('pylon', 8, y, 1, 1);
  const next = rng(1923);
  for (const w of track.waypoints) {
    const x = w.x / TILE - 0.5, y = w.y / TILE - 0.5, dx = x - 36, dy = y - 36, len = Math.hypot(dx, dy) || 1;
    for (const d of [8, 9, 10]) if (put('sign', Math.round(x + (dx / len) * d), Math.round(y + (dy / len) * d), 1, 1)) break;
  }
  const scatter = (kind: SnowKind, count: number, clear: number) => {
    for (let tries = 0, n = 0; n < count && tries < 3000; tries++) if (put(kind, 3 + Math.floor(next() * (track.cols - 6)), 3 + Math.floor(next() * (track.rows - 6)), clear)) n++;
  };
  scatter('chalet', CHALETS, 3);
  scatter('snowman', SNOWMEN, 2);
  scatter('pine', FOREST, 2);
  const out = { props, stands: STANDS.map(([x, y]) => centre(x, y)) };
  made.set(track.road, out);
  return out;
}

/** The minimap's lake: a tile of the ice is light blue (paler where the road crosses it), and the tiles come under the road's. */
export function lakeTiles(track: Track): { x: number; y: number; colour: string }[] {
  const { floor } = track;
  if (!floor) return [];
  const out: { x: number; y: number; colour: string }[] = [];
  for (let y = 0; y < track.rows; y++) {
    for (let x = 0; x < track.cols; x++) {
      const i = (y * TILE + TILE / 2) * track.size.w + x * TILE + TILE / 2;
      if (floor[i] !== FLOOR.ice) continue;
      out.push({ x, y, colour: track.road[i] === 1 ? SNOW.lakeRoad : SNOW.lake });
    }
  }
  return out;
}

const fillTri = (ctx: CanvasRenderingContext2D, cx: number, top: number, halfW: number, h: number, colour: string): void => {
  const rows = Math.max(1, Math.min(10, Math.ceil(h)));
  ctx.fillStyle = colour;
  for (let r = 0; r < rows; r++) { const w = (halfW * 2 * (r + 1)) / rows; ctx.fillRect(cx - w / 2, top + (h * r) / rows, w, h / rows + 0.6); }
};
const disc = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, colour: string): void => { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
const box = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string): void => { ctx.fillStyle = colour; ctx.fillRect(x, y, w, h); };

/** A prop standing at `at`, as big as its distance makes it: its foot on `at.sy`. */
export function snowProp(ctx: CanvasRenderingContext2D, at: Projected, kind: SnowKind): void {
  const u = at.scale, size = SNOW_SIZE[kind], x = at.sx, y = at.sy;
  if (size.h * u < 2) return;
  if (kind === 'pine') {
    box(ctx, x - 1.5 * u, y - 6 * u, 3 * u, 6 * u, SNOW.trunk);
    for (let j = 0; j < 3; j++) {
      const top = y - 14 * u - j * 9 * u, half = (9 - j * 2.2) * u;
      fillTri(ctx, x, top, half, 14 * u, j % 2 === 0 ? SNOW.pine : SNOW.pineDark);
      fillTri(ctx, x, top, half * 0.45, 6 * u, SNOW.pineSnow);
    }
  } else if (kind === 'chalet') {
    box(ctx, x - 14 * u, y - 14 * u, 28 * u, 14 * u, SNOW.wall);
    box(ctx, x - 14 * u, y - 14 * u, 28 * u, 2 * u, SNOW.wallDark);
    box(ctx, x - 9 * u, y - 10 * u, 6 * u, 5 * u, SNOW.window);
    box(ctx, x + 3 * u, y - 10 * u, 5 * u, 10 * u, SNOW.door);
    fillTri(ctx, x, y - 32 * u, 20 * u, 18 * u, SNOW.roof);
    fillTri(ctx, x, y - 32 * u, 11 * u, 10 * u, SNOW.roofSnow);
  } else if (kind === 'pylon') {
    box(ctx, x - 1.5 * u, y - 40 * u, 3 * u, 40 * u, SNOW.pylon);
    box(ctx, x - 7 * u, y - 40 * u, 14 * u, 2.5 * u, SNOW.pylon);
    box(ctx, x - 5 * u, y - 36 * u, 2 * u, 7 * u, SNOW.pylon);
    box(ctx, x - 7 * u, y - 30 * u, 4 * u, 3 * u, SNOW.chair);
  } else if (kind === 'snowman') {
    disc(ctx, x, y - 4 * u, 4.5 * u, SNOW.snowman);
    disc(ctx, x, y - 11 * u, 3.4 * u, SNOW.snowmanShade);
    disc(ctx, x, y - 16 * u, 2.6 * u, SNOW.snowman);
    box(ctx, x - 3 * u, y - 13 * u, 6 * u, 1.4 * u, SNOW.scarf);
    box(ctx, x, y - 16.5 * u, 3 * u, 1 * u, SNOW.carrot);
    box(ctx, x - 1.6 * u, y - 17.6 * u, 1 * u, 1 * u, SNOW.coal);
  } else {
    box(ctx, x - 0.8 * u, y - 12 * u, 1.6 * u, 12 * u, SNOW.post);
    box(ctx, x - 5 * u, y - 18 * u, 10 * u, 7 * u, SNOW.sign);
    box(ctx, x - 3 * u, y - 15.4 * u, 6 * u, 1.6 * u, SNOW.signMark);
  }
}

/** How wide a leg of the wooden arch stands in the world, and how high, in game pixels. */
const WOOD_LEG = { w: 6, h: 22 };

/** One leg of the wooden arch over the start (and, with the first, the beam between the legs, a red and white banner on it). */
export function woodArchLeg(ctx: CanvasRenderingContext2D, v: View, track: Track, leg: 0 | 1, at: Projected): void {
  const u = at.scale, h = WOOD_LEG.h * u;
  if (h < 1) return;
  const other = track.arch[leg === 0 ? 1 : 0];
  const beyond = project(v, other.x, other.y, groundAt(track, other.x, other.y));
  if (leg === 0 && beyond) {
    const left = Math.min(at.sx, beyond.sx), right = Math.max(at.sx, beyond.sx), top = Math.min(at.sy - h, beyond.sy - WOOD_LEG.h * beyond.scale);
    box(ctx, left, top, right - left, Math.max(1, 5 * u), SNOW.wood);
    box(ctx, left, top + Math.max(1, 5 * u), right - left, Math.max(1, 1 * u), SNOW.woodDark);
    const cells = 12, cw = (right - left) / cells, bh = Math.max(1, 4 * u);
    for (let i = 0; i < cells; i++) box(ctx, left + i * cw, top + Math.max(1, 6 * u), cw + 0.5, bh, i % 2 === 0 ? SNOW.banner : SNOW.bannerWhite);
  }
  box(ctx, at.sx - (WOOD_LEG.w * u) / 2, at.sy - h, WOOD_LEG.w * u, h, SNOW.wood);
  box(ctx, at.sx + (WOOD_LEG.w * u) / 6, at.sy - h, (WOOD_LEG.w * u) / 3, h, SNOW.woodDark);
}
