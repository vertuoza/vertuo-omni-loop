// OMNI DUET's collisions (PRD 1633): an orb is a circle, a block a rectangle that may be turned about
// its centre. A hit is an overlap: a circle that only touches an edge or a corner grazes the block and
// is no hit. A turned block is tested in its own frame: the circle's centre is turned back by the
// block's angle, then measured against the upright rectangle.
import type { Point } from './rules';

export interface Circle { x: number; y: number; r: number }

/** A block where it is now: its centre, its size, and its angle, in radians anticlockwise on the screen. */
export interface Block { cx: number; cy: number; w: number; h: number; angle: number }

/** `(x, y)` from the block's centre, in the screen's frame, turned anticlockwise on the screen by `angle`. */
function turned(x: number, y: number, angle: number): Point {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: x * c + y * s, y: -x * s + y * c };
}

/** The block's four corners on the screen: top left, top right, bottom right, bottom left, before it turns. */
export function corners(b: Block): readonly [Point, Point, Point, Point] {
  const at = (x: number, y: number): Point => { const p = turned(x, y, b.angle); return { x: b.cx + p.x, y: b.cy + p.y }; };
  const hw = b.w / 2, hh = b.h / 2;
  return [at(-hw, -hh), at(hw, -hh), at(hw, hh), at(-hw, hh)];
}

/** Whether the circle overlaps the block: strictly, so a graze is no hit. */
export function hits(c: Circle, b: Block): boolean {
  const local = turned(c.x - b.cx, c.y - b.cy, -b.angle);
  const hw = b.w / 2, hh = b.h / 2;
  const dx = local.x - Math.max(-hw, Math.min(hw, local.x));
  const dy = local.y - Math.max(-hh, Math.min(hh, local.y));
  return dx * dx + dy * dy < c.r * c.r;
}
