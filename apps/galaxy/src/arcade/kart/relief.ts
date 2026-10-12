// The ground under COMET RING (PRD 1698): how high the road stands at any point, from the circuit's relief
// (track.ts) along its racing line. Pure: a point's height is the height of the leg of the line nearest to it,
// at the place of that leg it stands beside, so the road's ups and downs follow the way it is driven and both
// sides of the road stand level. The physics reads the slope under a kart (kart.ts), the floor is rendered from
// a height for each pixel of the circuit's texture (mode7.ts), and the sprites stand on the ground (art.ts).
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Texture } from './mode7';
import { VOID } from './texture';
import { legHeight, type Track } from './track';

type Ground = Pick<Track, 'waypoints' | 'relief'>;

/** Whether a circuit is flat: every height and bump 0. */
const flat = ({ relief }: Ground): boolean => relief.heights.every((h) => h === 0) && relief.bumps.every((b) => b === 0);

/** The ground's height at x, y: the leg of the racing line nearest to it, at the point of that leg it stands beside. */
export function groundAt(track: Ground, x: number, y: number): number {
  if (flat(track)) return 0;
  const w = track.waypoints;
  let best = Infinity, leg = 0, along = 0, length = 1;
  for (let i = 0; i < w.length; i++) {
    const a = at(w, i, 'a waypoint'), b = at(w, (i + 1) % w.length, 'the next waypoint');
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const d = Math.min(len, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len));
    const ex = a.x + (dx / len) * d - x, ey = a.y + (dy / len) * d - y;
    const far = ex * ex + ey * ey;
    if (far < best) { best = far; leg = i; along = d; length = len; }
  }
  return legHeight(track.relief, leg, along, length);
}

/** How far ahead and behind a point the slope under it is measured, in world units. */
const REACH = 4;

/** The slope under a point facing `angle`: how much the ground rises a unit forward (negative: it falls). */
export function slopeAt(track: Ground, x: number, y: number, angle: number): number {
  if (flat(track)) return 0;
  const cos = Math.cos(angle) * REACH, sin = Math.sin(angle) * REACH;
  return (groundAt(track, x + cos, y + sin) - groundAt(track, x - cos, y - sin)) / (2 * REACH);
}

/** The lowest and the highest the road stands. */
export function reliefRange(track: Ground): { low: number; high: number } {
  let low = Infinity, high = -Infinity;
  const w = track.waypoints;
  w.forEach((a, i) => {
    const b = at(w, (i + 1) % w.length, 'the next waypoint');
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    for (let k = 0; k <= 32; k++) {
      const h = legHeight(track.relief, i, (k / 32) * length, length);
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
  });
  return { low: Number.isFinite(low) ? low : 0, high: Number.isFinite(high) ? high : 0 };
}

/** The ground's height under every pixel of the circuit's texture that is not the void (0 under the void): what the floor is rendered from. */
export function heightsOf(track: Ground, texture: Texture): Float32Array {
  const out = new Float32Array(texture.w * texture.h);
  if (flat(track)) return out;
  for (let y = 0; y < texture.h; y++) {
    for (let x = 0; x < texture.w; x++) {
      const i = y * texture.w + x;
      if (texture.px[i] !== VOID) out[i] = groundAt(track, x + 0.5, y + 0.5);
    }
  }
  return out;
}
