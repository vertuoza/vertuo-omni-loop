// A kart on the circuit (PRD 1359): its speed along the way it faces, steering that falls off with
// speed, and the wheels that lean it and slide it towards the void, and the void that takes it once both wheels of a side, or its centre, have tipped over the edge. Pure: one
// step of a kart is one call, and the race plays `dt` as several short ones (race.ts).
import type { Action } from '../keys';
import type { KartItem as Item } from '../scenes/kart.ts';
import { RULES } from './rules';
import { pastTreeLine, surfaceAt, TILE, tileAt, type Ground, type Surface } from './track';

/** A kart: where it stands, the way it faces (radians from east, y down) and its speed along that way (negative: reversing). */
export interface Kart {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly speed: number;
  /** The way it is steered, -1 left to 1 right: the kart leans into it. */
  readonly steer: -1 | 0 | 1;
  /** Its height over the ground (PRD 1775) and its vertical speed: absent on the road. A kart is in the air while either is above 0. */
  readonly height?: number;
  readonly lift?: number;
  /** The distance along the centre line it had a step before, in game pixels (PRD 1923): carried only on a circuit whose line crosses itself, so that a kart stays on its branch of the crossing. */
  readonly along?: number;
  /** The direction it travels in, radians as `angle` (PRD 1923): carried only while it slides on ice; absent, it travels the way it faces. */
  readonly travel?: number;
}

/** Whether a kart is in the air: it takes no box, no pad and no push, and cannot tip over. */
export const airborne = (k: { height?: number; lift?: number }): boolean => (k.height ?? 0) > 0 || (k.lift ?? 0) > 0;

/** What the player's hands ask of a kart: the buttons that count. */
export interface Pad { left: boolean; right: boolean; accel: boolean; brake: boolean; /** HOP held (PRD 1963); absent, not held: a kart that never hops drives as before. */ hop?: boolean }

/** The pad the buttons held make: ◀ ▶ steer, A accelerates, ▼ brakes, `up` is HOP (PRD 1963). */
export function padOf(held: ReadonlySet<Action>): Pad {
  return { left: held.has('left'), right: held.has('right'), accel: held.has('a'), brake: held.has('down'), ...(held.has('up') ? { hop: true } : {}) };
}

/** A kart standing at x, y facing `angle`, at rest. */
export const kartAt = (x: number, y: number, angle: number): Kart => ({ x, y, angle, speed: 0, steer: 0 });

/** How fast a kart turns at `speed`: nothing at rest, full grip at `gripSpeed`, less and less of it up to the top speed. */
export function turnRate(speed: number): number {
  const fast = Math.min(1, Math.abs(speed) / RULES.topSpeed);
  return RULES.steer * Math.min(1, Math.abs(speed) / RULES.gripSpeed) * (1 - (1 - RULES.steerAtTop) * fast);
}

/** What the gas adds, the brake takes off, and letting go takes off, per second (PRD 1963: on ice a share of the road's, `RULES.iceAccel`, `iceBrake` and `iceCoast`). */
const ratesOf = (ice: boolean) => ice
  ? { gas: RULES.iceAccel, stop: RULES.iceBrake, roll: RULES.iceCoast }
  : { gas: 1, stop: 1, roll: 1 };

/** The speed after `dt` seconds of ▼ (it brakes going forwards, reverses once stopped). */
const braked = (speed: number, dt: number, r: ReturnType<typeof ratesOf>): number =>
  speed > 0 ? Math.max(0, speed - RULES.brake * r.stop * dt) : Math.max(-RULES.reverseSpeed, speed - RULES.reverseAccel * r.gas * dt);

/** The speed after `dt` seconds of the gas, on ground whose top speed is `top`. */
const gassed = (speed: number, top: number, dt: number, r: ReturnType<typeof ratesOf>): number => {
  if (speed < 0) return Math.min(0, speed + RULES.brake * r.stop * dt);
  return speed < top ? Math.min(top, speed + RULES.accel * r.gas * dt) : speed;
};

/** The speed after `dt` seconds of what the pad asks, on ground whose top speed is `top`; `ice` scales the gas, the brake and the coast (PRD 1963), reversing included. */
function speedAfter(speed: number, pad: Pad, top: number, dt: number, ice = false): number {
  const r = ratesOf(ice);
  let next: number;
  if (pad.brake) next = braked(speed, dt, r);
  else if (pad.accel) next = gassed(speed, top, dt, r);
  else next = speed > 0 ? Math.max(0, speed - RULES.coast * r.roll * dt) : Math.min(0, speed + RULES.coast * r.roll * dt);
  return next > top ? Math.max(top, next - RULES.overspeedDrag * dt) : next;
}

/** What a slope does to the top speed: less uphill, more downhill, never under 0.67 nor over 1.33 of the flat one. */
const climbOf = (slope: number): number => Math.min(1.33, Math.max(0.67, 1 - RULES.climb * slope));

/** `a` as an angle in (-PI, PI]. */
const wrap = (a: number): number => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));

/** The way back (PRD 1963): off the ice a carried direction of travel turns back to the heading at `RULES.grip`, and is dropped within 0.01 radian of it. */
function wayBack(k: Kart, angle: number, dt: number): number | undefined {
  if (k.travel === undefined) return undefined;
  const back = wrap(angle - wrap(k.travel));
  const next = k.travel + Math.max(-RULES.grip * dt, Math.min(RULES.grip * dt, back));
  return Math.abs(wrap(angle - next)) < 0.01 ? undefined : next;
}

/** How a path follows the nose: its turn rate and how far it may lag (PRD 1963: a drift's, and on ice the lower grip and the larger slip of the two hold). */
function gripOn(ice: boolean, drifting: boolean): { rate: number; slip: number } {
  if (!drifting) return { rate: RULES.iceGrip, slip: RULES.iceSlip };
  return ice ? { rate: Math.min(RULES.driftGrip, RULES.iceGrip), slip: Math.max(RULES.driftSlip, RULES.iceSlip) } : { rate: RULES.driftGrip, slip: RULES.driftSlip };
}

/** The direction of travel after `dt` seconds on `surface` (PRD 1923): the heading, except on ice or in a drift (PRD 1963), where it turns towards the heading at the grip of `gripOn` and never lags it by more than its slip; otherwise a carried one turns back (`wayBack`). Absent when it is the heading. */
function travelAfter(k: Kart, angle: number, surface: Surface, dt: number, drifting = false): number | undefined {
  if (surface !== 'ice' && !drifting) return wayBack(k, angle, dt);
  const { rate, slip } = gripOn(surface === 'ice', drifting);
  const gap = wrap(angle - wrap(k.travel ?? k.angle)), turn = Math.max(-rate * dt, Math.min(rate * dt, gap));
  return angle - Math.max(-slip, Math.min(slip, gap - turn));
}

/** The turn of a drift towards `side` (PRD 1963): fast with its arrow held, slower with neither, slowest with the other. */
const driftRate = (side: -1 | 1, dir: -1 | 0 | 1): number => (dir === side ? RULES.driftTight : dir === 0 ? RULES.driftMid : RULES.driftWide);

/** The top speed's share a surface leaves (PRD 1923): powder caps it. */
const gripOf = (surface: Surface): number => (surface === 'powder' ? RULES.powder : 1);

/** The top speed on `surface` (PRD 1923): a BOOST lifts it, a rival's pace and a slope scale it, powder caps it. */
const topOf = (pace: number, boost: boolean, slope: number, surface: Surface): number =>
  (boost ? RULES.topSpeed * RULES.boostFactor * pace : RULES.topSpeed * pace) * climbOf(slope) * gripOf(surface);

/** The kart after a step of `speed` along `way` (the tree line: a step that would cross it stays where it was, at rest, as at a wall). */
function placed(k: Kart, map: Ground | undefined, to: { angle: number; speed: number; steer: -1 | 0 | 1; way: number; travel: number | undefined }, dt: number): Kart {
  const x = k.x + Math.cos(to.way) * to.speed * dt, y = k.y + Math.sin(to.way) * to.speed * dt;
  const slide = to.travel === undefined ? {} : { travel: to.travel };
  const walled = map !== undefined && pastTreeLine(map, x, y) && !pastTreeLine(map, k.x, k.y);
  return walled ? { x: k.x, y: k.y, angle: to.angle, speed: 0, steer: to.steer, ...slide } : { x, y, angle: to.angle, speed: to.speed, steer: to.steer, ...slide };
}

/** One short step of the kart's motion: the speed the pad asks for (a `boost` always asks for the gas), the turn and the move, over `map`'s surface under it (road when none): powder caps the top speed, ice lets the path lag the nose, a drift (PRD 1963) turns it towards its side, and the tree line stops it. `slope` is how much the ground rises a unit ahead of it. */
function moveKart(k: Kart, pad: Pad, dt: number, pace: number, boost: boolean, slope = 0, map?: Ground, drift?: -1 | 1): Kart {
  const surface = map ? surfaceAt(map, k.x, k.y) : 'road';
  const speed = speedAfter(k.speed, boost ? { ...pad, accel: true, brake: false } : pad, topOf(pace, boost, slope, surface), dt, surface === 'ice');
  const steer = dirOf(pad);
  const angle = k.angle + (drift === undefined ? steer * Math.sign(speed) * turnRate(speed) : drift * driftRate(drift, steer)) * dt;
  const travel = travelAfter(k, angle, surface, dt, drift !== undefined);
  return placed(k, map, { angle, speed, steer, way: travel ?? angle, travel }, dt);
}

/** One short step of a kart: the speed the pad asks for (a `boost` always asks for the gas), the turn and the move. `pace` scales its top speed (a rival's skill), `slope` the ground's rise a unit ahead, `map` the surface it drives on (road everywhere when left out). */
export function driveKart(k: Kart, pad: Pad, dt: number, pace = 1, boost = false, slope = 0, map?: Ground): Kart {
  return moveKart(k, pad, dt, pace, boost, slope, map);
}

/** What is on a kart besides its motion: the item it holds, the seconds of BOOST and of spin-out it has left, the seconds of falling left (PRD 1447) and the seconds it still blinks after the way back. */
export interface Fx { readonly item: Item | null; readonly boost: number; readonly spin: number; readonly fall: number; readonly blink: number; /** PRD 1963: the seconds a hop has left, the side of the drift running (-1 left, 1 right), its charge in seconds, and whether HOP was down at the last step (a hop starts as HOP goes down); each is absent at rest. */ readonly hop?: number; readonly drift?: -1 | 1; readonly charge?: number; readonly hopHeld?: true; /** The seconds the kart has been in a slipstream in a row (PRD 1963); absent at 0. */ readonly draft?: number; /** How long, in seconds, both wheels of one side have been over the void in a row (PRD 1775): the kart tips over once it reaches `RULES.tipGrace`. */ readonly tip: number }

/** A kart with nothing held and nothing on it. */
export const NO_FX: Fx = Object.freeze({ item: null, boost: 0, spin: 0, fall: 0, blink: 0, tip: 0 });

const HANDS_OFF: Pad = { left: false, right: false, accel: false, brake: false };

/** Whether the pixel at `x`, `y` holds a kart up (PRD 1923): anything but the void, so ice and powder never tip it over. */
const solid = (map: Ground, x: number, y: number): boolean => surfaceAt(map, x, y) !== 'void';

/**
 * Whether a kart has tipped over the edge: no road pixel but only void within `RULES.overhang` of its centre. Its centre may go
 * over the void, and most of its body with it, without falling while any of it is still over the road.
 */
export function tippedOver(map: Ground, k: { x: number; y: number }): boolean {
  const reach = RULES.overhang;
  if (solid(map, k.x, k.y)) return false;
  for (let py = Math.floor(k.y - reach); py <= Math.floor(k.y + reach); py++) {
    for (let px = Math.floor(k.x - reach); px <= Math.floor(k.x + reach); px++) {
      if (!solid(map, px, py)) continue;
      const dx = k.x - Math.max(px, Math.min(k.x, px + 1));
      const dy = k.y - Math.max(py, Math.min(k.y, py + 1));
      if (dx * dx + dy * dy < reach * reach) return false;
    }
  }
  return true;
}

/** How many of a kart's wheels are over the void, on its left and on its right: the wheels stand `RULES.wheelAlong` ahead and behind its centre, `RULES.wheelAcross` to each side. */
export function wheelsOver(map: Ground, k: { x: number; y: number; angle: number }): { left: number; right: number } {
  const cos = Math.cos(k.angle), sin = Math.sin(k.angle);
  let left = 0, right = 0;
  for (const along of [RULES.wheelAlong, -RULES.wheelAlong]) {
    for (const side of [-1, 1] as const) {
      // Its right is a quarter turn clockwise from the way it faces, y down.
      const x = k.x + cos * along - sin * side * RULES.wheelAcross, y = k.y + sin * along + cos * side * RULES.wheelAcross;
      if (solid(map, x, y)) continue;
      if (side < 0) left++; else right++;
    }
  }
  return { left, right };
}

/** The way a kart leans over the void, -1 (both wheels of its left over it) to 1 (both of its right): half a side for one more wheel out on that side. 0 when level. */
export function leanOf(map: Ground, k: { x: number; y: number; angle: number }): number {
  const { left, right } = wheelsOver(map, k);
  return (right - left) / 2;
}

/** Whether a kart tips over on its side: both wheels of one side over the void. */
export function tipsOver(map: Ground, k: { x: number; y: number; angle: number }): boolean {
  const { left, right } = wheelsOver(map, k);
  return left === 2 || right === 2;
}

/** A kart with more wheels over the void on one side slides towards that side at `RULES.tipPull` a second: the player can steer back onto the road. */
function pulledOver(map: Ground, k: Kart, dt: number): Kart {
  const { left, right } = wheelsOver(map, k);
  if (left === right) return k;
  const pull = Math.sign(right - left) * RULES.tipPull * dt;
  return { ...k, x: k.x - Math.sin(k.angle) * pull, y: k.y + Math.cos(k.angle) * pull };
}

/**
 * A kart whose centre is `RULES.overhang` past the edge and is not already falling starts to fall at once: at rest, its BOOST and any spin-out ended, the item it holds kept.
 * One with both wheels of one side over the void counts `dt` more seconds, and falls the same way once it has stayed out `RULES.tipGrace` in a row; a wheel back over the road starts the count again from 0.
 * With `dt` 0 (after a push) the count is only read, never moved. A kart in the air never falls. Anything else is the same objects back.
 */
export function fallIfOver<T extends { x: number; y: number; angle: number; speed: number; steer: number; height?: number; lift?: number }>(map: Ground, k: T, fx: Fx, dt = 0): { kart: T; fx: Fx } {
  if (fx.fall > 0 || airborne(k)) return { kart: k, fx };
  const tips = tipsOver(map, k);
  const tip = tips ? fx.tip + dt : dt > 0 ? 0 : fx.tip;
  if (tippedOver(map, k) || (tips && tip >= RULES.tipGrace - 1e-9)) {
    return { kart: { ...k, speed: 0, steer: 0 }, fx: { ...fx, boost: 0, spin: 0, fall: RULES.fallTime, tip: 0 } };
  }
  return tip === fx.tip ? { kart: k, fx } : { kart: k, fx: { ...fx, tip } };
}

/** How many pixels a hopping kart is drawn above the ground (PRD 1963): up and back down over `RULES.hopTime`, drawn only. */
export const hopLift = (fx: { hop?: number }): number => (fx.hop && fx.hop > 0 ? RULES.hopHeight * Math.sin(Math.PI * (1 - fx.hop / RULES.hopTime)) : 0);

/** `fx` with the hop and drift of PRD 1963 set to these; a field at rest is left out, so a kart that never hops carries the fx it always did. */
function marked(fx: Fx, hop: number, drift: -1 | 1 | undefined, charge: number, held: boolean): Fx {
  return {
    item: fx.item, boost: fx.boost, spin: fx.spin, fall: fx.fall, blink: fx.blink, tip: fx.tip,
    ...(hop > 0 ? { hop } : {}), ...(drift === undefined ? {} : { drift, charge }), ...(held ? { hopHeld: true as const } : {}),
  };
}

/** A kart's drift lost (PRD 1963): its charge goes with it and gives no turbo. The hop, if one runs, is kept. */
export const endDrift = (fx: Fx): Fx => marked(fx, fx.hop ?? 0, undefined, 0, fx.hopHeld === true);

/**
 * One short step of a kart with what is on it: a fall takes the input and holds the kart where it is, a spin-out takes the input and turns the kart on itself
 * (the speed it dropped to wears off like any other), a BOOST drives faster, a slope changes the top speed, a wheel over the void draws it towards the edge, and the timers run down. A kart that tips over the edge, or stays on its side over the void for the grace, starts to fall.
 * HOP going down on the ground hops it (drawn only, `hopLift`); a hop that lands with HOP and an arrow held, fast enough, starts a drift that charges while HOP is held and gives its mini-turbo as HOP is let go (PRD 1963).
 * The kart's `fx` after the step is returned with it, and whether its fall ended in this step (`landed`):
 * the way back is the race's to place (rivals.ts), never this step's.
 */
export function stepFx(map: Ground, k: Kart, pad: Pad, dt: number, pace: number, fx: Fx, slope = 0): { kart: Kart; fx: Fx; landed: boolean } {
  const held = pad.hop === true;
  if (fx.fall > 0) {
    const fall = Math.max(0, fx.fall - dt);
    return { kart: k, landed: fall === 0, fx: marked({ ...fx, fall, blink: Math.max(0, fx.blink - dt) }, 0, undefined, 0, held) };
  }
  const spinning = fx.spin > 0;
  if (airborne(k)) return fly(map, k, spinning ? HANDS_OFF : pad, dt, marked(fx, 0, undefined, 0, held), spinning);
  const { hop, landed } = hopOf(fx, held, spinning, dt);
  const drifting = fx.drift !== undefined && held && !pad.brake && !spinning ? fx.drift : undefined;
  const moved = pulledOver(map, moveKart(k, spinning ? HANDS_OFF : pad, dt, pace, !spinning && fx.boost > 0, slope, map, drifting), dt);
  const kart = spinning ? { ...moved, angle: moved.angle + RULES.spinRate * dt, steer: 0 as const } : moved;
  const onPad = tileAt(map.map, Math.floor(kart.x / TILE), Math.floor(kart.y / TILE)) === '+';
  const ran: Fx = { ...fx, boost: onPad ? RULES.boostTime : Math.max(0, fx.boost - dt), spin: Math.max(0, fx.spin - dt), blink: Math.max(0, fx.blink - dt) };
  const flying = leavesRamp(map, k, kart) ? { ...kart, height: 0, lift: RULES.launch * kart.speed } : kart;
  const turned = driftAfter(map, kart, pad, dt, fx, ran.boost, drifting, landed);
  const result = fallIfOver(map, flying, { ...ran, boost: turned.boost }, dt);
  return settled(result, hop, turned, held);
}

/** The hop after `dt` seconds (PRD 1963): HOP going down on the ground, while no hop runs, starts one; `landed` when it ends in this step. */
function hopOf(fx: Fx, held: boolean, spinning: boolean, dt: number): { hop: number; landed: boolean } {
  const starts = held && !fx.hopHeld && !spinning && (fx.hop ?? 0) <= 0;
  const was = starts ? RULES.hopTime : fx.hop ?? 0;
  const hop = Math.max(0, was - dt);
  return { hop, landed: was > 0 && hop === 0 };
}

/** The step's result with its hop and drift: a fall or a jump off a ramp loses both (PRD 1963). */
function settled(r: { kart: Kart; fx: Fx }, hop: number, turned: { side: -1 | 1 | undefined; charge: number }, held: boolean): { kart: Kart; fx: Fx; landed: boolean } {
  const lost = r.fx.fall > 0 || airborne(r.kart);
  return { kart: r.kart, fx: lost ? marked(r.fx, 0, undefined, 0, held) : marked(r.fx, hop, turned.side, turned.charge, held), landed: false };
}

/** The BOOST a drift's charge gives when HOP is let go (PRD 1963): orange, blue or none. */
const turboOf = (charge: number): number => (charge >= RULES.chargeOrange ? RULES.miniOrange : charge >= RULES.chargeBlue ? RULES.miniBlue : 0);

/** What a drift leaves after a step (PRD 1963): its side (absent: none), its charge and the BOOST the kart has. */
interface Drift { side: -1 | 1 | undefined; charge: number; boost: number }

/** Whether a kart is going at least `RULES.driftMin` of the top speed. */
const quick = (kart: Kart): boolean => kart.speed >= RULES.driftMin * RULES.topSpeed;

/** A drift that goes on while HOP is held (PRD 1963): its charge grows on road and ice and stands still on powder; a speed under half loses it. */
function kept(map: Ground, kart: Kart, dt: number, fx: Fx, boost: number, side: -1 | 1): Drift {
  if (!quick(kart)) return { side: undefined, charge: 0, boost };
  return { side, charge: (fx.charge ?? 0) + (surfaceAt(map, kart.x, kart.y) === 'powder' ? 0 : dt), boost };
}

/** A drift that HOP's release, ▼ or a spin-out ended: the release gives the turbo its charge earned (never shortening a BOOST running), the others give none. */
function ended(kart: Kart, pad: Pad, fx: Fx, boost: number): Drift {
  const turbo = quick(kart) && !pad.brake && fx.spin <= 0 ? turboOf(fx.charge ?? 0) : 0;
  return { side: undefined, charge: 0, boost: Math.max(boost, turbo) };
}

/** A drift that a hop that has just landed starts: HOP and an arrow held, fast enough. */
function begun(kart: Kart, pad: Pad, fx: Fx, boost: number, landed: boolean): Drift {
  const arrow = dirOf(pad);
  const starts = landed && pad.hop === true && quick(kart) && fx.spin <= 0;
  return { side: starts && arrow !== 0 ? arrow : undefined, charge: 0, boost };
}

/** The drift after a step (PRD 1963): `kept` while HOP is held, `ended` once it is let go, a ▼ or a spin-out, `begun` by a landing hop. */
function driftAfter(map: Ground, kart: Kart, pad: Pad, dt: number, fx: Fx, boost: number, drifting: -1 | 1 | undefined, landed: boolean): Drift {
  if (drifting !== undefined) return kept(map, kart, dt, fx, boost, drifting);
  return fx.drift === undefined ? begun(kart, pad, fx, boost, landed) : ended(kart, pad, fx, boost);
}

/** Whether a kart going forwards left a ramp tile in this step, onto a tile that is not a ramp: it takes off. */
function leavesRamp(map: Ground, from: Kart, to: Kart): boolean {
  if (to.speed <= 0) return false;
  const was = tileAt(map.map, Math.floor(from.x / TILE), Math.floor(from.y / TILE));
  return was === '^' && tileAt(map.map, Math.floor(to.x / TILE), Math.floor(to.y / TILE)) !== '^';
}

/** The way a pad steers, -1 left to 1 right. */
const dirOf = (pad: Pad): -1 | 0 | 1 => (pad.right === pad.left ? 0 : pad.right ? 1 : -1);

/** One short step of a kart in the air: its speed holds, it steers at `RULES.airSteer` of its turn rate, gravity pulls it down, no wheel pulls it and it cannot tip over. It lands when its height comes back to 0, and the ordinary rules apply there. */
function fly(map: Ground, k: Kart, pad: Pad, dt: number, fx: Fx, spinning: boolean): { kart: Kart; fx: Fx; landed: boolean } {
  const dir = dirOf(pad);
  const angle = k.angle + dir * Math.sign(k.speed) * turnRate(k.speed) * RULES.airSteer * dt + (spinning ? RULES.spinRate * dt : 0);
  const aloft = { x: k.x + Math.cos(angle) * k.speed * dt, y: k.y + Math.sin(angle) * k.speed * dt, angle, speed: k.speed, steer: spinning ? 0 as const : dir };
  const lift = (k.lift ?? 0) - RULES.gravity * dt;
  const height = (k.height ?? 0) + lift * dt;
  const ran: Fx = { ...fx, boost: Math.max(0, fx.boost - dt), spin: Math.max(0, fx.spin - dt), blink: Math.max(0, fx.blink - dt) };
  return height > 0 ? { kart: { ...aloft, height, lift }, fx: ran, landed: false } : { ...fallIfOver(map, aloft, ran, dt), landed: false };
}

/** Whether `me` builds a slipstream behind `other` (PRD 1963): both at `draftMin` of the top speed or more, on the ground and not falling, `me` within `draftRange` pixels and `draftLine` radians of the line straight back from `other`'s heading. */
export function drafts(me: { kart: Kart; fx: Fx }, other: { kart: Kart; fx: Fx }): boolean {
  const min = RULES.draftMin * RULES.topSpeed;
  if (me.kart.speed < min || other.kart.speed < min) return false;
  if (airborne(me.kart) || airborne(other.kart) || me.fx.fall > 0 || other.fx.fall > 0) return false;
  const dx = me.kart.x - other.kart.x, dy = me.kart.y - other.kart.y;
  const dist = Math.hypot(dx, dy);
  if (dist > RULES.draftRange || dist === 0) return false;
  const off = Math.atan2(dy, dx) - (other.kart.angle + Math.PI);
  return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) <= RULES.draftLine;
}

/** `fx` after `dt` seconds in (`on`) or out of a slipstream (PRD 1963): the count grows while it holds and starts again from 0 when it breaks; `draftTime` seconds of it give a BOOST of `draftBoost` seconds (never cutting a longer one) and start the count again. */
export function draftAfter(fx: Fx, on: boolean, dt: number): Fx {
  const { draft, ...rest } = fx;
  if (!on) return rest;
  const count = (draft ?? 0) + dt;
  if (count >= RULES.draftTime) return { ...rest, boost: Math.max(fx.boost, RULES.draftBoost) };
  return { ...rest, draft: count };
}
