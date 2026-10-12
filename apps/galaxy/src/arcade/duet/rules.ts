// OMNI DUET's numbers (PRD 1633): one constants block, chosen by eye, so a follow-up tunes the feel
// without touching the engine. Lengths are the playfield's game pixels (320×288 on both grids), times
// in seconds, angles in radians, counted anticlockwise on the screen from the centre's right.
import type { Action } from '../keys';

export const RULES = Object.freeze({
  /** The one playfield both grids draw: the whole tall grid, centred and scaled to the wide grid's height. */
  field: Object.freeze({ w: 320, h: 288 }),
  /** The centre the orbs turn around, in the lower third of the playfield. */
  centre: Object.freeze({ x: 160, y: 212 }),
  /** The circle the two orbs ride, and each orb's own radius. */
  radius: 56,
  orbRadius: 6,
  /** ◀ or ▶ held turns the pair this many turns a second (a half turn in 0.4 s). */
  turnsPerSecond: 1.25,
  /** The fixed step the run is played in, and the longest frame played at once: the same run at 60 or 120 frames a second. */
  subStep: 1 / 60,
  maxDt: 0.05,
  /** How many past steps each orb's trail shows. */
  trail: 6,
});

/** Where the held buttons turn the pair: 1 anticlockwise (◀), -1 clockwise (▶), 0 for both or neither. */
export function turnOf(held: ReadonlySet<Action>): -1 | 0 | 1 {
  const left = held.has('left'), right = held.has('right');
  if (left === right) return 0;
  return left ? 1 : -1;
}

/** The pair's angle after `dt` seconds with `held`, at the constant turning speed. */
export function turn(angle: number, held: ReadonlySet<Action>, dt: number): number {
  const dir = turnOf(held);
  return dir === 0 ? angle : angle + dir * Math.PI * 2 * RULES.turnsPerSecond * dt;
}

export interface Point { x: number; y: number }

/** The two orbs at `angle`, always opposite: the warm one at `angle`, the cool one half a turn on. */
export function orbs(angle: number): readonly [Point, Point] {
  const at = (a: number): Point => ({ x: RULES.centre.x + RULES.radius * Math.cos(a), y: RULES.centre.y - RULES.radius * Math.sin(a) });
  return [at(angle), at(angle + Math.PI)];
}
