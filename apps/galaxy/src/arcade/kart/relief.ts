// The ground under COMET RING (PRD 1698): how high the road stands at any point, from the circuit's relief
// (track.ts) along its racing line. Pure: a point's height is the height of the leg of the line nearest to it,
// at the place of that leg it stands beside, so the road's ups and downs follow the way it is driven and both
// sides of the road stand level. The physics reads the slope under a kart (kart.ts), the floor is rendered from
// a height for each pixel of the circuit's texture (mode7.ts), and the sprites stand on the ground (art.ts).
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Texture } from './mode7';
import { VOID } from './texture';
import { LEVEL, legHeight, type Track } from './track';

type Ground = Pick<Track, 'waypoints' | 'relief'> & Partial<Pick<Track, 'shortcuts'>>;

/** Whether a circuit is flat: every height and bump 0. */
const flat = ({ relief }: Ground): boolean => relief.heights.every((h) => h === 0) && relief.bumps.every((b) => b === 0);

/** The nearest leg of the racing line to x, y: its squared distance, its index, the way along it and its length. */
function nearestLeg(w: Ground['waypoints'], x: number, y: number) {
  let best = Infinity, leg = 0, along = 0, length = 1;
  for (let i = 0; i < w.length; i++) {
    const a = at(w, i, 'a waypoint'), b = at(w, (i + 1) % w.length, 'the next waypoint');
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const d = Math.min(len, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len));
    const ex = a.x + (dx / len) * d - x, ey = a.y + (dy / len) * d - y;
    const far = ex * ex + ey * ey;
    if (far < best) { best = far; leg = i; along = d; length = len; }
  }
  return { best, leg, along, length };
}

/** The height of the racing line alone (no shortcut) at x, y. */
function lineGround(track: Ground, x: number, y: number): number {
  const { leg, along, length } = nearestLeg(track.waypoints, x, y);
  return legHeight(track.relief, leg, along, length);
}

/** The ground at the two ends of each shortcut's leg, read once per circuit: where it leaves the racing line and where it rejoins it. */
const ends = new WeakMap<object, readonly (readonly [number, number])[]>();
function endsOf(track: Ground, shortcuts: NonNullable<Ground['shortcuts']>): readonly (readonly [number, number])[] {
  const known = ends.get(shortcuts);
  if (known) return known;
  const made = shortcuts.map(({ from, to }): readonly [number, number] => [lineGround(track, from.x, from.y), lineGround(track, to.x, to.y)]);
  ends.set(shortcuts, made);
  return made;
}

/**
 * The ground's height at x, y: the leg of the racing line nearest to it, at the point of that leg it stands beside
 * (PRD 1775: or a shortcut's own leg, when that is strictly nearer). A shortcut's ground is level for `LEVEL` where it
 * leaves the line, as the line is around a corner, then eases to the ground of the line where it rejoins it, so the
 * line's own ground is the same with or without it.
 */
export function groundAt(track: Ground, x: number, y: number): number {
  if (flat(track)) return 0;
  const main = nearestLeg(track.waypoints, x, y);
  const shortcuts = track.shortcuts ?? [];
  let best = main.best, height = legHeight(track.relief, main.leg, main.along, main.length);
  shortcuts.forEach((s, i) => {
    const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y, len = Math.hypot(dx, dy) || 1;
    const d = Math.min(len, Math.max(0, ((x - s.from.x) * dx + (y - s.from.y) * dy) / len));
    const ex = s.from.x + (dx / len) * d - x, ey = s.from.y + (dy / len) * d - y;
    const far = ex * ex + ey * ey;
    if (far >= best) return;
    const [low, high] = endsOf(track, shortcuts)[i] ?? [0, 0];
    const t = Math.min(1, Math.max(0, (d - LEVEL) / Math.max(1, len - LEVEL)));
    best = far;
    height = low + (high - low) * t * t * (3 - 2 * t);
  });
  return height;
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
