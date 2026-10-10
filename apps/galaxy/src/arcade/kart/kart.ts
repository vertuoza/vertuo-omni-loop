// A kart on the circuit (PRD 1359): its speed along the way it faces, steering that falls off with
// speed, and the void that takes it when its centre goes over. Pure: one
// step of a kart is one call, and the race plays `dt` as several short ones (race.ts).
import type { Action } from '../keys';
import type { KartItem as Item } from '../scenes/kart.ts';
import { RULES } from './rules';
import { TILE, tileAt } from './track';

/** A kart: where it stands, the way it faces (radians from east, y down) and its speed along that way (negative: reversing). */
export interface Kart {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly speed: number;
  /** The way it is steered, -1 left to 1 right: the kart leans into it. */
  readonly steer: -1 | 0 | 1;
}

/** What the player's hands ask of a kart: the buttons that count. */
export interface Pad { left: boolean; right: boolean; accel: boolean; brake: boolean }

/** The pad the buttons held make: ◀ ▶ steer, A accelerates, ▼ brakes. */
export function padOf(held: ReadonlySet<Action>): Pad {
  return { left: held.has('left'), right: held.has('right'), accel: held.has('a'), brake: held.has('down') };
}

/** A kart standing at x, y facing `angle`, at rest. */
export const kartAt = (x: number, y: number, angle: number): Kart => ({ x, y, angle, speed: 0, steer: 0 });

/** How fast a kart turns at `speed`: nothing at rest, full grip at `gripSpeed`, less and less of it up to the top speed. */
export function turnRate(speed: number): number {
  const fast = Math.min(1, Math.abs(speed) / RULES.topSpeed);
  return RULES.steer * Math.min(1, Math.abs(speed) / RULES.gripSpeed) * (1 - (1 - RULES.steerAtTop) * fast);
}

/** The speed after `dt` seconds of what the pad asks, on ground whose top speed is `top`. */
function speedAfter(speed: number, pad: Pad, top: number, dt: number): number {
  let next = speed;
  if (pad.brake) {
    next = speed > 0 ? Math.max(0, speed - RULES.brake * dt) : Math.max(-RULES.reverseSpeed, speed - RULES.reverseAccel * dt);
  } else if (pad.accel) {
    next = speed < 0 ? Math.min(0, speed + RULES.brake * dt) : speed < top ? Math.min(top, speed + RULES.accel * dt) : speed;
  } else {
    next = speed > 0 ? Math.max(0, speed - RULES.coast * dt) : Math.min(0, speed + RULES.coast * dt);
  }
  return next > top ? Math.max(top, next - RULES.overspeedDrag * dt) : next;
}

/** One short step of the kart's motion: the speed the pad asks for (a `boost` always asks for the gas), the turn and the move. */
function moveKart(k: Kart, pad: Pad, dt: number, pace: number, boost: boolean): Kart {
  const top = boost ? RULES.topSpeed * RULES.boostFactor * pace : RULES.topSpeed * pace;
  const speed = speedAfter(k.speed, boost ? { ...pad, accel: true, brake: false } : pad, top, dt);
  const dir = (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
  const angle = k.angle + dir * Math.sign(speed) * turnRate(speed) * dt;
  const x = k.x + Math.cos(angle) * speed * dt, y = k.y + Math.sin(angle) * speed * dt;
  return { x, y, angle, speed, steer: dir === 0 ? 0 : dir > 0 ? 1 : -1 };
}

/** One short step of a kart: the speed the pad asks for (a `boost` always asks for the gas), the turn and the move. `pace` scales its top speed (a rival's skill). */
export function driveKart(k: Kart, pad: Pad, dt: number, pace = 1, boost = false): Kart {
  return moveKart(k, pad, dt, pace, boost);
}

/** What is on a kart besides its motion: the item it holds, the seconds of BOOST and of spin-out it has left, the seconds of falling left (PRD 1447) and the seconds it still blinks after the way back. */
export interface Fx { readonly item: Item | null; readonly boost: number; readonly spin: number; readonly fall: number; readonly blink: number }

/** A kart with nothing held and nothing on it. */
export const NO_FX: Fx = Object.freeze({ item: null, boost: 0, spin: 0, fall: 0, blink: 0 });

const HANDS_OFF: Pad = { left: false, right: false, accel: false, brake: false };

/** Whether the tile under a kart's centre is the void: its body may hang over the edge without falling. */
const isOverVoid = (map: readonly string[], k: { x: number; y: number }): boolean => tileAt(map, Math.floor(k.x / TILE), Math.floor(k.y / TILE)) === '~';

/** A kart whose centre is over the void and is not already falling starts to fall: at rest, its BOOST and any spin-out ended, the item it holds kept. Anything else is the same objects back. */
export function fallIfOver<T extends { x: number; y: number; speed: number; steer: number }>(map: readonly string[], k: T, fx: Fx): { kart: T; fx: Fx } {
  if (fx.fall > 0 || !isOverVoid(map, k)) return { kart: k, fx };
  return { kart: { ...k, speed: 0, steer: 0 }, fx: { ...fx, boost: 0, spin: 0, fall: RULES.fallTime } };
}

/**
 * One short step of a kart with what is on it: a fall takes the input and holds the kart where it is, a spin-out takes the input and turns the kart on itself
 * (the speed it dropped to wears off like any other), a BOOST drives faster, and the timers run down. A kart whose centre goes over the void starts to fall.
 * The kart's `fx` after the step is returned with it, and whether its fall ended in this step (`landed`):
 * the way back is the race's to place (rivals.ts), never this step's.
 */
export function stepFx(map: readonly string[], k: Kart, pad: Pad, dt: number, pace: number, fx: Fx): { kart: Kart; fx: Fx; landed: boolean } {
  if (fx.fall > 0) {
    const fall = Math.max(0, fx.fall - dt);
    return { kart: k, landed: fall === 0, fx: { ...fx, fall, blink: Math.max(0, fx.blink - dt) } };
  }
  const spinning = fx.spin > 0;
  const moved = moveKart(k, spinning ? HANDS_OFF : pad, dt, pace, !spinning && fx.boost > 0);
  const kart = spinning ? { ...moved, angle: moved.angle + RULES.spinRate * dt, steer: 0 as const } : moved;
  const ran: Fx = { ...fx, boost: Math.max(0, fx.boost - dt), spin: Math.max(0, fx.spin - dt), blink: Math.max(0, fx.blink - dt) };
  return { ...fallIfOver(map, kart, ran), landed: false };
}
