// The Mode 7 projection (PRD 1359): a flat floor seen in perspective from a camera above and behind
// the player's kart, turning with it. Pure: it maps screen to floor and floor to screen, fills a pixel
// buffer one sample per floor pixel, and orders and scales the sprites that stand on the floor. The
// canvas it ends on is art.ts's.
//
// World units are the circuit's texture pixels (a tile is 16). The camera looks along `angle`
// (radians from east, y down); the screen is `w`×`h`, with the horizon `horizon` pixels from the top,
// and the floor below it. A point `z` ahead of the camera, `up` over the floor's level 0, lands
// `(height - up)·focal / z` pixels under the horizon, and a sprite `z` away is drawn `focal / z` times
// its size. The road has ups and downs (relief.ts, PRD 1698): `renderTerrain` draws it column by column,
// the road's edge showing the side of a thick deck over the void; `renderFloor` is the flat floor.

import { RULES } from './rules';
import { pack } from './texture';
import { roofAt, TILE, type Ground } from './track';

export interface View {
  /** The screen, in pixels. */
  readonly w: number;
  readonly h: number;
  /** The screen row the floor starts under: the floor is the rows below it. */
  readonly horizon: number;
  /** The distance, in pixels, from the eye to the screen: the field of view's width. */
  readonly focal: number;
  /** The eye's height over the floor's level 0, in world units: its height over the ground under the kart, plus that ground's. */
  readonly height: number;
  /** Where the camera stands on the floor, and the way it looks. */
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** A point nearer than this ahead of the camera is behind it, as far as drawing goes. */
export const NEAR = 4;

/** The eye's height over the floor, and how far behind the kart it sits, in world units. */
const EYE_HEIGHT = 28;
const EYE_BACK = 40;

/** The horizon stands a third of the way down: the floor is 640×240 on the wide grid, 320×192 on the tall one. */
export const horizonOf = (h: number): number => Math.round(h / 3);

/** A camera for a screen `w`×`h`, standing at `x`, `y` and looking along `angle`: a 60° field of view, the eye `EYE_HEIGHT` over `ground` (the ground under the kart it follows). */
export function viewOf(screen: { w: number; h: number }, cam: { x: number; y: number; angle: number }, ground = 0): View {
  return { w: screen.w, h: screen.h, horizon: horizonOf(screen.h), focal: screen.w * 0.866, height: EYE_HEIGHT + ground, ...cam };
}

/** The camera's place behind a kart standing at `x`, `y` and heading `angle`: `back` behind it (`EYE_BACK` unless told), looking where it does. */
export function chaseCamera(kart: { x: number; y: number; angle: number }, back = EYE_BACK): { x: number; y: number; angle: number } {
  return { x: kart.x - Math.cos(kart.angle) * back, y: kart.y - Math.sin(kart.angle) * back, angle: kart.angle };
}

/** How far ahead of the camera a floor point lands on screen row `row` of a screen `w`×`h`: the camera that far behind a kart sees it on that row. */
export function depthAt(screen: { w: number; h: number }, row: number): number {
  const v = viewOf(screen, { x: 0, y: 0, angle: 0 });
  return (v.height * v.focal) / (row - v.horizon);
}

/** The floor point under screen point `sx`, `sy`; null on or above the horizon, where there is none. */
export function floorAt(v: View, sx: number, sy: number): { x: number; y: number } | null {
  const down = sy - v.horizon;
  if (down <= 0) return null;
  const z = (v.height * v.focal) / down;
  const side = ((sx - v.w / 2) / v.focal) * z;
  const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
  return { x: v.x + cos * z - sin * side, y: v.y + sin * z + cos * side };
}

/** Where a floor point lands on the screen, how far ahead it is and how big it draws (a size of 1 at `focal` away); null behind the camera. */
export interface Projected { sx: number; sy: number; z: number; scale: number }

/** Where the point `wx`, `wy`, `up` over the floor's level 0 (the ground there, for a sprite standing on it), lands on the screen. */
export function project(v: View, wx: number, wy: number, up = 0): Projected | null {
  const dx = wx - v.x, dy = wy - v.y;
  const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
  const z = dx * cos + dy * sin;
  if (z < NEAR) return null;
  const side = -dx * sin + dy * cos;
  return { sx: v.w / 2 + (side * v.focal) / z, sy: v.horizon + ((v.height - up) * v.focal) / z, z, scale: v.focal / z };
}

/** The sprites in front of the camera, from the farthest to the nearest, each with where and how big it draws, standing on the ground `ground` gives it (level 0 unless told). */
export function spritesInView<T extends { x: number; y: number }>(v: View, sprites: readonly T[], ground?: (sprite: T) => number): { sprite: T; at: Projected }[] {
  const seen: { sprite: T; at: Projected }[] = [];
  for (const sprite of sprites) {
    const at = project(v, sprite.x, sprite.y, ground?.(sprite) ?? 0);
    if (at) seen.push({ sprite, at });
  }
  return seen.sort((a, b) => b.at.z - a.at.z);
}

/** A texture: `w`×`h` pixels, each one packed 0xAABBGGRR as a canvas's little-endian pixel buffer holds it. */
export interface Texture { readonly w: number; readonly h: number; readonly px: Uint32Array }

/**
 * Fills the floor of `out`, a `v.w`×`v.h` pixel buffer, one sample of `texture` per screen pixel: the
 * rows under the horizon, and nothing above it. A floor point past the texture's edge reads `beyond`.
 */
export function renderFloor(v: View, texture: Texture, out: Uint32Array, beyond: number): void {
  const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
  for (let row = Math.floor(v.horizon) + 1; row < v.h; row++) {
    const z = (v.height * v.focal) / (row + 0.5 - v.horizon);
    const k = z / v.focal; // the floor one screen pixel across covers
    const left = -(v.w / 2) * k;
    let wx = v.x + cos * z - sin * left, wy = v.y + sin * z + cos * left;
    const stepX = -sin * k, stepY = cos * k;
    wx += stepX * 0.5; wy += stepY * 0.5;
    const base = row * v.w;
    for (let col = 0; col < v.w; col++) {
      const tx = Math.floor(wx), ty = Math.floor(wy);
      out[base + col] = tx >= 0 && ty >= 0 && tx < texture.w && ty < texture.h ? (texture.px[ty * texture.w + tx] ?? beyond) : beyond;
      wx += stepX; wy += stepY;
    }
  }
}

/**
 * What the road's edge shows over the void: the side of its deck, `thickness` deep, shaded from `wall`'s first colour
 * at the top to its last at the bottom (`stripe` on every other panel), then a glow `glow` deep under it, fading
 * through `glowPx` (packed with their alpha).
 */
export interface Deck { readonly thickness: number; readonly wall: Uint32Array; readonly stripe: Uint32Array; readonly glow: number; readonly glowPx: Uint32Array }

/** How wide a panel of the deck's side is, in world units. */
const PANEL = 6;

/** The most samples a column of the floor takes (PRD 1698): the floor of a frame costs at most `w` × this. */
const MAX_SAMPLES = 600;
const sampleZ = new Float32Array(MAX_SAMPLES), sampleUp = new Float32Array(MAX_SAMPLES), sampleAlong = new Float32Array(MAX_SAMPLES);
const samplePx = new Uint32Array(MAX_SAMPLES), sampleRoof = new Uint8Array(MAX_SAMPLES);

/** A colour of `glow` (its alpha says how much) laid over the packed pixel `under`; the glow itself over nothing. */
function over(under: number, glow: number): number {
  if (under >>> 24 === 0) return glow;
  const a = (glow >>> 24) / 255, b = 1 - a;
  const r = ((glow & 0xff) * a + (under & 0xff) * b) | 0;
  const g = (((glow >>> 8) & 0xff) * a + ((under >>> 8) & 0xff) * b) | 0;
  const bl = (((glow >>> 16) & 0xff) * a + ((under >>> 16) & 0xff) * b) | 0;
  return (0xff000000 | (bl << 16) | (g << 8) | r) >>> 0;
}

/** A number of a typed array, 0 past its end. */
const read = (list: ArrayLike<number>, i: number): number => list[i] ?? 0;

/** What drawing a frame's columns shares: the screen, the deck, the buffers drawn into, and the screen row of a point `up` high, `z` away. */
interface Pass { readonly v: View; readonly deck: Deck; readonly out: Uint32Array; readonly depth: Float32Array; readonly texture: Texture; readonly roofed?: Uint8Array | undefined; readonly vault?: Vault | undefined; row(up: number, z: number): number }

/** The ground of column `col` sampled outwards from `first`, about a row a sample and at most `MAX_SAMPLES` of them, into the scratch arrays; how many it took. */
function sampleColumn(v: View, texture: Texture, heights: Float32Array, col: number, bounds: { first: number; far: number; k: number; roofed?: Uint8Array | undefined }): number {
  const across = (col + 0.5 - v.w / 2) / v.focal;
  const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
  const dx = cos - sin * across, dy = sin + cos * across;
  let n = 0;
  for (let z = bounds.first; z < bounds.far && n < MAX_SAMPLES; z += Math.max(0.25, (z * z) / bounds.k)) {
    const wx = v.x + dx * z, wy = v.y + dy * z;
    const tx = Math.floor(wx), ty = Math.floor(wy);
    const inside = tx >= 0 && ty >= 0 && tx < texture.w && ty < texture.h;
    const i = inside ? ty * texture.w + tx : -1;
    sampleZ[n] = z;
    samplePx[n] = read(texture.px, i);
    sampleUp[n] = read(heights, i);
    sampleAlong[n] = wx + wy;
    sampleRoof[n] = bounds.roofed ? read(bounds.roofed, i) : 0;
    n++;
  }
  return n;
}

/** The side of the deck under the road's edge at sample `i` of column `col`, panel by panel from the screen row `from`, then its glow over what is there. */
function paintDeck(p: Pass, col: number, i: number, from: number): void {
  const { v, deck, out, depth } = p;
  const z = read(sampleZ, i), up = read(sampleUp, i), near = read(sampleZ, i - 1) || z;
  const base = p.row(up - deck.thickness, near), deep = base - p.row(up, near);
  const levels = deck.wall.length, glows = deck.glowPx.length;
  const shade = Math.floor(read(sampleAlong, i) / PANEL) % 2 === 0 ? deck.wall : deck.stripe;
  const end = Math.min(v.h, Math.ceil(base));
  for (let r = Math.max(0, from); r < end; r++) {
    out[r * v.w + col] = read(shade, Math.min(levels - 1, Math.floor(((r - (base - deep)) / deep) * levels)));
    depth[r * v.w + col] = z;
  }
  const glow = (deck.glow * v.focal) / near;
  const last = Math.min(v.h, Math.ceil(base + glow));
  for (let r = Math.max(0, end); r < last; r++) {
    const g = read(deck.glowPx, Math.min(glows - 1, Math.floor(((r - base) / glow) * glows)));
    out[r * v.w + col] = over(read(out, r * v.w + col), g);
  }
}

/** Sample `i` of column `col` drawn: the road it covers down to the next nearer sample, and where that one is the void, the road's edge shows the deck. */
function paintSample(p: Pass, col: number, i: number): void {
  const { v, out, depth } = p;
  const c = read(samplePx, i);
  if (c === 0) return;
  const z = read(sampleZ, i), up = read(sampleUp, i);
  const near = read(sampleZ, i - 1) || z * 0.98;
  const edge = i > 0 && read(samplePx, i - 1) === 0;
  const ground = edge || i === 0 ? up : Math.min(up, read(sampleUp, i - 1));
  const bottom = Math.min(v.h, Math.ceil(p.row(ground, near)));
  for (let r = Math.max(0, Math.ceil(p.row(up, z))); r < bottom; r++) { out[r * v.w + col] = c; depth[r * v.w + col] = z; }
  if (edge) paintDeck(p, col, i, bottom);
}

/**
 * Fills `out`, a `v.w`×`v.h` pixel buffer, with the road and its relief: one column of the screen at a time, the
 * ground sampled along it from the camera outwards (each sample about a row of the screen from the last, and at most
 * `MAX_SAMPLES` of them), then drawn back from the farthest, a near hill covering what stands behind it. A sample of
 * the road covers the rows down to the next nearer one; where that one is the void, the road ends there and its edge
 * shows the side of its deck, then a glow under it, laid over what was there. `heights` holds the ground's height
 * under every pixel of `texture`, `range` the lowest and the highest of them. `depth` gets how far every pixel drawn
 * of the road is (Infinity elsewhere), so a sprite behind a hill is hidden (art.ts). The void, and the space above
 * the road, stay see-through. Returns the most samples a column took.
 * `roofed` (PRD 1775, `roofedOf`) marks the pixels of the tunnel's roofed road: over each stands a roof `ROOF` up, with
 * a wall on every edge toward the void and a lit portal where it meets the open road; only the columns whose ray
 * reaches a roofed pixel pay for it, and the samples a column takes do not change.
 */
export function renderTerrain(v: View, texture: Texture, heights: Float32Array, range: { low: number; high: number }, deck: Deck, out: Uint32Array, depth: Float32Array, roofed?: Uint8Array): number {
  out.fill(0);
  depth.fill(Infinity);
  const above = v.height - range.high;
  const bounds = {
    first: above > 0 ? Math.max(NEAR, (above * v.focal) / (v.h - v.horizon)) : NEAR,
    far: Math.hypot(texture.w, texture.h),
    // A step of z²/k moves a point of the lowest ground (the deck's underside) one row at most.
    k: (v.height - range.low + deck.thickness) * v.focal,
    roofed,
  };
  const pass: Pass = { v, deck, out, depth, texture, roofed, vault: roofed ? vaultOf(texture, roofed) : undefined, row: (up, z) => v.horizon + ((v.height - up) * v.focal) / z - 0.5 };
  let most = 0;
  for (let col = 0; col < v.w; col++) {
    const n = sampleColumn(v, texture, heights, col, bounds);
    most = Math.max(most, n);
    const across = (col + 0.5 - v.w / 2) / v.focal;
    const ray = { dx: Math.cos(v.angle) - Math.sin(v.angle) * across, dy: Math.sin(v.angle) + Math.cos(v.angle) * across };
    for (let i = n - 1; i >= 0; i--) {
      paintSample(pass, col, i);
      if (roofed && (read(sampleRoof, i) || read(sampleRoof, i - 1))) paintTunnel(pass, col, i, ray);
    }
    if (roofed) paintNearWall(pass, col, ray, heights, bounds.first);
  }
  return most;
}

/** How high the tunnel's roof stands over its ground, in world units (PRD 1775). */
export const ROOF = 44;

/**
 * The ceiling's height over its ground at every pixel of the texture, and off it (PRD 1829): read from how far the pixel stands
 * from the void, once for the texture rather than at every ray (bug 1868).
 */
interface Vault { readonly w: number; readonly h: number; readonly ceiling: Float32Array; readonly beyond: number }
const vaults = new WeakMap<Uint8Array, { texture: Texture; vault: Vault }>();

/** The vault of `texture` under the mask `roofed`, from each pixel's distance to the nearest void pixel (0 at it), by a two-pass chamfer; memoised on the mask. */
function vaultOf(texture: Texture, roofed: Uint8Array): Vault {
  const known = vaults.get(roofed);
  if (known && known.texture === texture) return known.vault;
  const dist = chamfer(texture);
  let half = 0;
  for (let i = 0; i < dist.length; i++) if (read(roofed, i) === 1) half = Math.max(half, read(dist, i));
  const ceiling = dist.map((d) => arcAt(d, half));
  const vault = { w: texture.w, h: texture.h, ceiling, beyond: half > 0 ? ROOF - RULES.vault : ROOF };
  vaults.set(roofed, { texture, vault });
  return vault;
}

/** Each pixel's distance to the nearest void pixel: one pass down and to the right from the neighbours already seen, one back up and to the left. */
function chamfer(texture: Texture): Float32Array {
  const { w, h } = texture;
  const dist = new Float32Array(w * h);
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? Infinity : read(dist, y * w + x));
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      dist[y * w + x] = read(texture.px, y * w + x) === 0 ? 0 : Math.min(at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D, at(x + 1, y - 1) + D);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const d = Math.min(read(dist, y * w + x), at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D, at(x - 1, y + 1) + D);
      dist[y * w + x] = Number.isFinite(d) ? d : 0;
    }
  }
  return dist;
}

/** How much of a quarter circle the vault is: a shallower arc than a full one, so its slope at the wall is finite and the wall can meet it. */
const VAULT_ARC = 0.8;

/**
 * The ceiling's height over its ground `dist` pixels from the void, the farthest roofed pixel standing `half` from it (PRD 1829):
 * `ROOF` over the centre of the road, falling along an arc to `ROOF - RULES.vault` at the walls, where it meets them.
 */
function arcAt(dist: number, half: number): number {
  if (half <= 0) return ROOF;
  const d = Math.max(0, dist - 1); // the road's first pixel is at the wall: the ceiling meets it there
  const t = Math.max(0, Math.min(1, 1 - d / Math.max(1, half - 1)));
  return ROOF - RULES.vault * (1 - Math.sqrt(1 - (VAULT_ARC * t) ** 2)) / (1 - Math.sqrt(1 - VAULT_ARC ** 2));
}

/** The ceiling's height over its ground at `wx`, `wy`. */
function ceilingAt(p: Pass, wx: number, wy: number): number {
  const vault = p.vault;
  if (!vault) return ROOF;
  const tx = Math.floor(wx), ty = Math.floor(wy);
  if (tx < 0 || ty < 0 || tx >= vault.w || ty >= vault.h) return vault.beyond;
  return read(vault.ceiling, ty * vault.w + tx);
}

/** The tunnel's colours, packed like the floor's: panels, seams, strips of light, and the lit portal frame and porthole rims, warm (bug 1813). */
export const TUNNEL = Object.freeze({
  ceilingA: pack('#383f4a'), ceilingB: pack('#434b57'), ceilingSeam: pack('#1e222a'), strip: pack('#d0f0f4'),
  roofA: pack('#555d6a'), roofB: pack('#636c79'), roofSeam: pack('#808a95'),
  wallInA: pack('#404a5a'), wallInB: pack('#4e5a6b'), wallOutA: pack('#58626f'), wallOutB: pack('#66707d'), wallSeam: pack('#20262e'), trim: pack('#2a303a'),
  rim: pack('#ffe29a'), portal: pack('#fff0a8'),
});

/** Which pixels of `texture` are roofed road (1) and which are not (0): what `renderTerrain` draws the tunnel from. */
export function roofedOf(track: Pick<Ground, 'size' | 'roof'>, texture: Texture): Uint8Array {
  const out = new Uint8Array(texture.w * texture.h);
  for (let y = 0; y < texture.h; y++) {
    for (let x = 0; x < texture.w; x++) if (roofAt(track, x, y)) out[y * texture.w + x] = 1;
  }
  return out;
}

const mod = (a: number, b: number): number => ((a % b) + b) % b;

/** Whether the point `wx`, `wy` is on the checkerboard's first colour, a tile a square. */
const checker = (wx: number, wy: number): boolean => (Math.floor(wx / TILE) + Math.floor(wy / TILE)) % 2 === 0;
/** Whether the point `wx`, `wy` is on a seam between two panels. */
const seam = (wx: number, wy: number): boolean => mod(wx, TILE) < 1 || mod(wy, TILE) < 1;

/** The roof's top at `wx`, `wy`: panels a tile wide, seams between. */
function roofTop(wx: number, wy: number): number {
  if (seam(wx, wy)) return TUNNEL.roofSeam;
  return checker(wx, wy) ? TUNNEL.roofA : TUNNEL.roofB;
}

/** The ceiling's pixel under the roof at `wx`, `wy`: panels a tile wide, seams between, strips of light. */
function ceilingPixel(wx: number, wy: number): number {
  if (mod(wx, 32) < 4 || mod(wy, 32) < 3) return TUNNEL.strip;
  if (seam(wx, wy)) return TUNNEL.ceilingSeam;
  return checker(wx, wy) ? TUNNEL.ceilingA : TUNNEL.ceilingB;
}

/** Whether the pixel at `wx`, `wy` is roofed. */
function roofedAt(p: Pass, wx: number, wy: number): boolean {
  const tx = Math.floor(wx), ty = Math.floor(wy);
  return tx >= 0 && ty >= 0 && tx < p.texture.w && ty < p.texture.h && read(p.roofed ?? [], ty * p.texture.w + tx) === 1;
}

/** The distance at which the ray of `ray`, between `near` and `far` (the first not like the second), stops being roofed. */
function roofEdge(p: Pass, ray: { dx: number; dy: number }, near: number, far: number): number {
  const { v } = p;
  const was = roofedAt(p, v.x + ray.dx * near, v.y + ray.dy * near);
  let lo = near, hi = far;
  for (let k = 0; k < 6; k++) {
    const mid = (lo + hi) / 2;
    if (roofedAt(p, v.x + ray.dx * mid, v.y + ray.dy * mid) === was) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Where a wall or a portal stands on a ray: its distance, the ground under it, the way it faces, and a point a step under its roof. */
interface Edge { z: number; ground: number; inside: boolean; portal: boolean; sideways: boolean; wx: number; wy: number; under: { x: number; y: number } }

/** How far past a roofed edge its open side is read: past the neon the texture paints on the void's first pixels, so only open road reads there. */
const PAST_EDGE = TILE / 2;

/**
 * The edge where the roof ends `at.z` along the ray: which way it runs, read in the roofed mask around it (a ray between
 * two samples can cross both a row and a column of pixels), and whether its open side is road (a portal) or the void (a wall).
 */
function edgeAt(p: Pass, ray: { dx: number; dy: number }, at: { z: number; ground: number; inside: boolean }): Edge {
  const { v, texture } = p;
  const wx = v.x + ray.dx * at.z, wy = v.y + ray.dy * at.z;
  const sideways = roofedAt(p, wx, wy - 1) !== roofedAt(p, wx, wy + 1); // the roof ends across y: the wall runs along x
  const [nx, ny] = sideways ? [0, roofedAt(p, wx, wy - 1) ? -1 : 1] : [roofedAt(p, wx - 1, wy) ? -1 : 1, 0]; // a step under the roof
  const ox = Math.floor(wx - nx * PAST_EDGE), oy = Math.floor(wy - ny * PAST_EDGE);
  const open = ox >= 0 && oy >= 0 && ox < texture.w && oy < texture.h ? read(texture.px, oy * texture.w + ox) : 0;
  return { ...at, portal: open !== 0, sideways, wx, wy, under: { x: wx + nx, y: wy + ny } };
}

/** The wall's panel at `along` its length: two tones a tile wide, a dark seam between, lighter inside than out. */
function wallPanel(inside: boolean, along: number): number {
  if (mod(along, TILE) < 1) return TUNNEL.wallSeam;
  const tones = inside ? [TUNNEL.wallInA, TUNNEL.wallInB] : [TUNNEL.wallOutA, TUNNEL.wallOutB];
  return tones[Math.floor(along / TILE) % 2 === 0 ? 0 : 1] ?? TUNNEL.wallSeam;
}

/** The wall's pixel `u` units over its ground, at `along` its length: trim at the ends, a porthole on the starfield (0) with a rim inside, panels between. */
function wallPixel(edge: Edge, along: number, u: number, top: number): number {
  if (u > top - 2 || u < 1.5) return TUNNEL.trim;
  const ring = edge.inside ? Math.hypot(mod(along, TILE) - TILE / 2, u - ROOF / 2) : Infinity;
  if (ring < 4.5) return 0;
  return ring < 6 ? TUNNEL.rim : wallPanel(edge.inside, along);
}

/** The wall (or the portal's frame) standing on the roofed edge at distance `z` of column `col`: from the ground up to the roof. */
function paintWall(p: Pass, col: number, edge: Edge): void {
  const { v, out, depth } = p;
  const { z, ground } = edge;
  // The wall meets the vault where it ends: at the ceiling over the road just inside it, a side wall's lowest, a portal's as high as the road's width gives.
  const reachUp = ceilingAt(p, edge.under.x, edge.under.y);
  const top = Math.max(0, Math.ceil(p.row(ground + reachUp, z))), bottom = Math.min(v.h, Math.ceil(p.row(ground, z)));
  const along = edge.sideways ? edge.wx : edge.wy; // across the edge's plane, along the wall
  const reach = 3; // how far along the edge, under the roof, a neighbour has to be to tell the opening's side
  const { x, y } = edge.under;
  const side = edge.sideways ? [roofedAt(p, x - reach, y), roofedAt(p, x + reach, y)] : [roofedAt(p, x, y - reach), roofedAt(p, x, y + reach)];
  const post = edge.portal && side.includes(false);
  for (let r = top; r < bottom; r++) {
    const u = v.height - ((r + 0.5 - v.horizon) * z) / v.focal - ground; // the height over the ground
    const lit = post || u > reachUp - 5;
    if (edge.portal && !lit) continue;
    out[r * v.w + col] = edge.portal ? TUNNEL.portal : wallPixel(edge, along, u, reachUp);
    depth[r * v.w + col] = z;
  }
}

/** A stretch of a column's roof: from `near` to `far` over ground `ground`; `first` when nothing is nearer, `toWall` when it ends at a wall. */
interface RoofSpan { near: number; far: number; ground: number; ray: { dx: number; dy: number }; nearGround?: number; first?: boolean; toWall?: boolean }

/** The roof's top, seen from above, over the rows `lo` to `hi`: flat. */
function paintRoofTop(p: Pass, col: number, span: RoofSpan, rows: { lo: number; hi: number; lift: number }): void {
  const { v, out, depth } = p;
  for (let r = rows.lo; r < rows.hi; r++) {
    const flat = (rows.lift * v.focal) / (r + 0.5 - v.horizon); // the row's distance on the roof at its level
    if (flat <= 0) continue;
    const z = Math.max(flat, span.near), i = r * v.w + col;
    out[i] = roofTop(v.x + span.ray.dx * z, v.y + span.ray.dy * z);
    depth[i] = z;
  }
}

/** The ceiling's height over the ground, where the ray of `span` is `z` ahead. */
function ceilingOver(p: Pass, span: RoofSpan, z: number): number {
  return ceilingAt(p, p.v.x + span.ray.dx * z, p.v.y + span.ray.dy * z);
}

/** How long a piece of a span's ceiling is at most, in world units: it is read at both ends of the piece and runs straight between (bug 1868). */
const PIECE = 2;

/** Where the ceiling of `span` is looked for from: its near end, or, for the first span, as near as the top row of the frame can meet it. */
function ceilingStart(p: Pass, span: RoofSpan): number {
  if (!span.first) return span.near;
  const { v } = p;
  const top = ((v.height - span.ground - (ROOF - RULES.vault)) * v.focal) / (0.5 - v.horizon); // where the top row's ray meets the lowest ceiling
  return Math.min(span.near, Math.max(0.5, top));
}

/** Row `r` of column `col` shows the ceiling `z` ahead on the ray of `span`. */
function paintCeilingAt(p: Pass, col: number, span: RoofSpan, r: number, z: number): void {
  const i = r * p.v.w + col;
  p.out[i] = ceilingPixel(p.v.x + span.ray.dx * z, p.v.y + span.ray.dy * z);
  p.depth[i] = z;
}

/**
 * The ceiling over `span` from `start` to its far end, from the far end in, so the nearest ceiling a ray meets is the one it
 * keeps. Straight within a piece, the ceiling a ray enters there is met at a distance solved in one step: the rows between the
 * piece's two ends, nothing else. The ceiling's height at `start`.
 */
function paintPieces(p: Pass, col: number, span: RoofSpan, start: number, above: number): number {
  const { v } = p;
  const eye = v.height - span.ground;
  const n = Math.max(1, Math.ceil((span.far - start) / PIECE)), dz = (span.far - start) / n;
  let z1 = span.far, c1 = ceilingOver(p, span, z1);
  for (let k = n - 1; k >= 0 && dz > 0; k--) {
    const z0 = start + k * dz, c0 = ceilingOver(p, span, z0);
    const slope = (c1 - c0) / dz, r1 = p.row(span.ground + c1, z1);
    for (let r = Math.max(0, Math.floor(p.row(span.ground + c0, z0)) + 1); r <= r1 && r < above; r++) {
      paintCeilingAt(p, col, span, r, ((eye - c0 + slope * z0) * v.focal) / (r + 0.5 - v.horizon + slope * v.focal));
    }
    z1 = z0;
    c1 = c0;
  }
  return c1;
}

/**
 * The vaulted ceiling over the stretch `span` of column `col`, seen from below (PRD 1829). A span that ends at a wall shows its
 * far end in the rows that pass under it there, where the wall stands; the first span, and a step's face in the rows `flat` of
 * the flat roof, show their near end in the rows that meet the ceiling nearer than it is looked for.
 */
function paintCeiling(p: Pass, col: number, span: RoofSpan, flat: { lo: number; hi: number }, stepped: boolean): void {
  const above = Math.min(p.v.h, Math.ceil(p.v.horizon - 0.5)); // the rows whose centre is above the horizon
  if (span.toWall) {
    const last = p.row(span.ground + ceilingOver(p, span, span.far), span.far);
    const to = Math.min(above, Math.max(flat.hi, Math.ceil(last) + 2));
    for (let r = Math.max(0, Math.floor(last) + 1); r < to; r++) paintCeilingAt(p, col, span, r, span.far);
  }
  const start = ceilingStart(p, span);
  const atStart = paintPieces(p, col, span, start, above);
  if (!span.first && !stepped) return;
  const first = p.row(span.ground + atStart, start), to = span.first ? above : Math.min(above, flat.hi);
  for (let r = span.first ? 0 : flat.lo; r <= first && r < to; r++) paintCeilingAt(p, col, span, r, span.near);
}

/**
 * The ceiling (or, from above, the roof's top) over the stretch of column `col` between `near` and `far`, at the roof of
 * ground `ground`. Where the roof at `near` stood farther from the eye (`nearGround`, a hump's far side), the stretch
 * reaches back to it, so the face of the step leaves no gap (bug 1813). From below the ceiling is vaulted (PRD 1829): its height
 * falls toward the walls, so each row solves where its ray meets it.
 */
function paintRoof(p: Pass, col: number, span: RoofSpan): void {
  const { v } = p;
  const level = span.ground + ROOF, lift = v.height - level;
  if (Math.abs(lift) < 0.01) return;
  const step = (span.nearGround ?? span.ground) + ROOF;
  const a = p.row(lift < 0 ? Math.max(level, step) : Math.min(level, step), span.near), b = p.row(level, span.far);
  const flat = { lo: Math.max(0, Math.ceil(Math.min(a, b))), hi: Math.min(v.h, Math.ceil(Math.max(a, b))) };
  if (lift >= 0) { paintRoofTop(p, col, span, { ...flat, lift }); return; }
  paintCeiling(p, col, span, flat, span.nearGround !== undefined && span.nearGround !== span.ground);
}

/** The wall (or portal) the ray of column `col` meets before the first sample: nearer than anything the samples reach, whether the camera stands on roofed road or beside it. */
function paintNearWall(p: Pass, col: number, ray: { dx: number; dy: number }, heights: Float32Array, first: number): void {
  const { v, texture } = p;
  const at = (z: number) => ({ x: v.x + ray.dx * z, y: v.y + ray.dy * z });
  const index = (z: number) => { const { x, y } = at(z); return x >= 0 && y >= 0 && x < texture.w && y < texture.h ? Math.floor(y) * texture.w + Math.floor(x) : -1; };
  const was = roofedAt(p, at(NEAR).x, at(NEAR).y);
  for (let z = NEAR + 2; z < first + 2; z += 2) {
    const here = at(z);
    if (roofedAt(p, here.x, here.y) === was) continue;
    const roofedSide = was ? z - 2 : z;
    const wall = edgeAt(p, ray, { z: roofEdge(p, ray, z - 2, z), ground: read(heights, index(roofedSide)), inside: was });
    // From inside, the vault lowers the ceiling over what lies nearer than the first sample: it runs up to the wall.
    if (was) paintRoof(p, col, { near: NEAR, far: wall.z, ground: wall.ground, ray, first: true, toWall: true });
    paintWall(p, col, wall);
    return;
  }
}

/** What the roofed road adds to the stretch of column `col` between samples `i - 1` and `i`: its roof or ceiling, and the wall or portal standing where the roof ends. */
function paintTunnel(p: Pass, col: number, i: number, ray: { dx: number; dy: number }): void {
  const b = read(sampleRoof, i) === 1, a = i > 0 ? read(sampleRoof, i - 1) === 1 : b;
  const z1 = read(sampleZ, i), z0 = i > 0 ? read(sampleZ, i - 1) : z1 * 0.98;
  const ground = b ? read(sampleUp, i) : read(sampleUp, i - 1);
  if (a === b) { paintRoof(p, col, { near: z0, far: z1, ground, ray, nearGround: i > 0 ? read(sampleUp, i - 1) : ground, first: i === 0 }); return; }
  const zb = roofEdge(p, ray, z0, z1);
  const wall = edgeAt(p, ray, { z: zb, ground, inside: a });
  const piece = { near: a ? z0 : zb, far: b ? z1 : zb, ground, ray };
  if (b) { paintRoof(p, col, piece); paintWall(p, col, wall); } else { paintWall(p, col, wall); paintRoof(p, col, piece); }
}

/** How far the sky has scrolled sideways, in pixels of a panorama `panorama` wide, for a camera looking along `angle`: turning right scrolls it left. */
export function skyShift(angle: number, panorama: number): number {
  const turns = angle / (Math.PI * 2);
  return (((-turns * panorama) % panorama) + panorama) % panorama;
}
