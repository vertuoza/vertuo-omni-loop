// The ground under COMET RING (PRD 1698): how high the road stands at any point, from the circuit's relief
// (track.ts) along its centre line. Pure: a point's height is the height of the centre line at the point nearest to it
// (PRD 1829): level over each arc, easing along each straight, so the road's ups and downs follow the way it is driven, both
// sides of the road stand level and a curve never twists. The physics reads the slope under a kart (kart.ts), the floor is rendered from
// a height for each pixel of the circuit's texture (mode7.ts), and the sprites stand on the ground (art.ts).
import { locate, segmentAt } from './line';
import type { Texture } from './mode7';
import { VOID } from './texture';
import { LEVEL, legHeight, TILE, type Track } from './track';

type Ground = Pick<Track, 'centre' | 'relief'> & Partial<Pick<Track, 'shortcuts'>>;

/** Whether a circuit is flat: every height and bump 0. */
const flat = ({ relief }: Ground): boolean => relief.heights.every((h) => h === 0) && relief.bumps.every((b) => b === 0);

/** The height of the centre line itself `along` tiles along it: level over an arc, eased along a straight. */
function lineHeight(track: Ground, along: number): number {
  const seg = segmentAt(track.centre, along);
  if (seg.kind === 'arc') return track.relief.heights[seg.corner] ?? 0;
  const d = Math.min(seg.len, Math.max(0, (((along % track.centre.length) + track.centre.length) % track.centre.length) - seg.start));
  return legHeight(track.relief, seg.leg, d * TILE, seg.len * TILE);
}

/** The height of the racing line alone (no shortcut) at x, y, in game pixels, and the squared distance to it. */
function lineGround(track: Ground, x: number, y: number): { height: number; far: number } {
  const at = locate(track.centre, x / TILE, y / TILE);
  return { height: lineHeight(track, at.along), far: (at.dist * TILE) ** 2 };
}

/** The ground at the two ends of each shortcut's leg, read once per circuit: where it leaves the racing line and where it rejoins it. */
const ends = new WeakMap<object, readonly (readonly [number, number])[]>();
function endsOf(track: Ground, shortcuts: NonNullable<Ground['shortcuts']>): readonly (readonly [number, number])[] {
  const known = ends.get(shortcuts);
  if (known) return known;
  const made = shortcuts.map(({ from, to }): readonly [number, number] => [lineGround(track, from.x, from.y).height, lineGround(track, to.x, to.y).height]);
  ends.set(shortcuts, made);
  return made;
}

/**
 * The ground's height at x, y: the centre line's, at the point of it nearest to x, y
 * (PRD 1775: or a shortcut's own leg, when that is strictly nearer). A shortcut's ground is level for `LEVEL` where it
 * leaves the line, as the line is around a corner, then eases to the ground of the line where it rejoins it, so the
 * line's own ground is the same with or without it.
 */
export function groundAt(track: Ground, x: number, y: number): number {
  if (flat(track)) return 0;
  const main = lineGround(track, x, y);
  const shortcuts = track.shortcuts ?? [];
  let best = main.far, height = main.height;
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
  const { length } = track.centre;
  for (let along = 0; along < length; along += 0.25) {
    const h = lineHeight(track, along);
    low = Math.min(low, h);
    high = Math.max(high, h);
  }
  return { low: Number.isFinite(low) ? low : 0, high: Number.isFinite(high) ? high : 0 };
}

/** The ground's height under every pixel of the circuit's texture that is not the void (0 under the void): what the floor is rendered from. */
const made = new WeakMap<Texture, Float32Array>();
export function heightsOf(track: Ground, texture: Texture): Float32Array {
  const known = made.get(texture);
  if (known && known.length === texture.w * texture.h) return known;
  const out = new Float32Array(texture.w * texture.h);
  if (!flat(track)) {
    for (let y = 0; y < texture.h; y++) {
      for (let x = 0; x < texture.w; x++) {
        const i = y * texture.w + x;
        if (texture.px[i] !== VOID) out[i] = groundAt(track, x + 0.5, y + 0.5);
      }
    }
  }
  made.set(texture, out);
  return out;
}
