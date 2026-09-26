// The D-pad is one rocker: the direction comes from where the finger is relative to the cross's
// centre. Close to the centre is a dead zone; outside it the axis with the larger offset wins, and a
// tie goes to the vertical axis. The game has no diagonals.

export type Direction = 'up' | 'down' | 'left' | 'right';

/** CSS px from the centre, in straight-line distance, under which the finger gives no direction. */
export const DEAD_ZONE = 10;

/** The direction of a finger at `(dx, dy)` from the cross's centre, y pointing down; null in the dead zone. */
export function dpadDirection(dx: number, dy: number): Direction | null {
  if (Math.hypot(dx, dy) < DEAD_ZONE) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
