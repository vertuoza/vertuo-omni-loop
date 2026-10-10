// The Mode 7 projection (PRD 1359): a flat floor seen in perspective from a camera above and behind
// the player's kart, turning with it. Pure: it maps screen to floor and floor to screen, fills a pixel
// buffer one sample per floor pixel, and orders and scales the sprites that stand on the floor. The
// canvas it ends on is art.ts's.
//
// World units are the circuit's texture pixels (a tile is 16). The camera looks along `angle`
// (radians from east, y down); the screen is `w`×`h`, with the horizon `horizon` pixels from the top,
// and the floor below it. A point `z` ahead of the camera on the floor lands `height·focal / z`
// pixels under the horizon, and a sprite `z` away is drawn `focal / z` times its size.

export interface View {
  /** The screen, in pixels. */
  readonly w: number;
  readonly h: number;
  /** The screen row the floor starts under: the floor is the rows below it. */
  readonly horizon: number;
  /** The distance, in pixels, from the eye to the screen: the field of view's width. */
  readonly focal: number;
  /** The eye's height over the floor, in world units. */
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

/** A camera for a screen `w`×`h`, standing at `x`, `y` and looking along `angle`: a 60° field of view. */
export function viewOf(screen: { w: number; h: number }, cam: { x: number; y: number; angle: number }): View {
  return { w: screen.w, h: screen.h, horizon: horizonOf(screen.h), focal: screen.w * 0.866, height: EYE_HEIGHT, ...cam };
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

export function project(v: View, wx: number, wy: number): Projected | null {
  const dx = wx - v.x, dy = wy - v.y;
  const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
  const z = dx * cos + dy * sin;
  if (z < NEAR) return null;
  const side = -dx * sin + dy * cos;
  return { sx: v.w / 2 + (side * v.focal) / z, sy: v.horizon + (v.height * v.focal) / z, z, scale: v.focal / z };
}

/** The sprites in front of the camera, from the farthest to the nearest, each with where and how big it draws. */
export function spritesInView<T extends { x: number; y: number }>(v: View, sprites: readonly T[]): { sprite: T; at: Projected }[] {
  const seen: { sprite: T; at: Projected }[] = [];
  for (const sprite of sprites) {
    const at = project(v, sprite.x, sprite.y);
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

/** How far the sky has scrolled sideways, in pixels of a panorama `panorama` wide, for a camera looking along `angle`: turning right scrolls it left. */
export function skyShift(angle: number, panorama: number): number {
  const turns = angle / (Math.PI * 2);
  return (((-turns * panorama) % panorama) + panorama) % panorama;
}
