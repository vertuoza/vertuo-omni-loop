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
const samplePx = new Uint32Array(MAX_SAMPLES);

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
interface Pass { readonly v: View; readonly deck: Deck; readonly out: Uint32Array; readonly depth: Float32Array; row(up: number, z: number): number }

/** The ground of column `col` sampled outwards from `first`, about a row a sample and at most `MAX_SAMPLES` of them, into the scratch arrays; how many it took. */
function sampleColumn(v: View, texture: Texture, heights: Float32Array, col: number, bounds: { first: number; far: number; k: number }): number {
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
 */
export function renderTerrain(v: View, texture: Texture, heights: Float32Array, range: { low: number; high: number }, deck: Deck, out: Uint32Array, depth: Float32Array): number {
  out.fill(0);
  depth.fill(Infinity);
  const above = v.height - range.high;
  const bounds = {
    first: above > 0 ? Math.max(NEAR, (above * v.focal) / (v.h - v.horizon)) : NEAR,
    far: Math.hypot(texture.w, texture.h),
    // A step of z²/k moves a point of the lowest ground (the deck's underside) one row at most.
    k: (v.height - range.low + deck.thickness) * v.focal,
  };
  const pass: Pass = { v, deck, out, depth, row: (up, z) => v.horizon + ((v.height - up) * v.focal) / z - 0.5 };
  let most = 0;
  for (let col = 0; col < v.w; col++) {
    const n = sampleColumn(v, texture, heights, col, bounds);
    most = Math.max(most, n);
    for (let i = n - 1; i >= 0; i--) paintSample(pass, col, i);
  }
  return most;
}

/** How far the sky has scrolled sideways, in pixels of a panorama `panorama` wide, for a camera looking along `angle`: turning right scrolls it left. */
export function skyShift(angle: number, panorama: number): number {
  const turns = angle / (Math.PI * 2);
  return (((-turns * panorama) % panorama) + panorama) % panorama;
}
