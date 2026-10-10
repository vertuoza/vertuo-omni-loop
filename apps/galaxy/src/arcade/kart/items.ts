// The items of OMNI KART (PRD 1359, slice 5), pure and seeded like race.ts: the boxes across the road,
// the draw weighted by place, BOOST, BLOB and ORB, the spin-out, and the plain rules the rivals use
// them by. Racers are indexed 0 (the player) then the rivals; `stepItems` plays one short step of the world.
import type { KartItem as Item } from '../scenes/kart.ts';
import type { Fx, Kart } from './kart';
import { RULES } from './rules';
import { draw } from './rivals';
import { TILE, tileAt, type Track } from './track';

export type { Item };

/** An item box: where it stands, and the seconds left before it is back (0 when it can be taken). */
export interface Box { x: number; y: number; back: number }
/** A BLOB lying on the road. */
export interface Blob { x: number; y: number }
/** An ORB in flight: where, the way it flies, how many walls it bounced off and how long it has flown. */
export interface Orb { x: number; y: number; angle: number; bounces: number; age: number }

/** The items on the circuit, and the seeded generator the draws come from. */
export interface World { boxes: readonly Box[]; blobs: readonly Blob[]; orbs: readonly Orb[]; rng: number }

/** A kart with what it holds and what is on it. */
export interface Racer { kart: Kart; fx: Fx }

/** The world at the start of a race: every box there, nothing thrown. */
export function newWorld(track: Track, seed: number): World {
  return { boxes: track.boxes.map((b) => ({ x: b.x, y: b.y, back: 0 })), blobs: [], orbs: [], rng: (seed ^ 0x1359) | 0 };
}

/** The weights of the draw for `place` (1 = the leader, 6 = last): the leaders get more BLOBs, the karts behind more BOOSTs and ORBs. */
export function weights(place: number): Record<Item, number> {
  const behind = (Math.min(Math.max(place, 1), 6) - 1) / 5;
  return { boost: 0.2 + 0.5 * behind, blob: 0.6 - 0.5 * behind, orb: 0.2 + 0.3 * behind };
}

/** The item a roll in [0, 1) gives a kart in `place`. */
export function itemFor(place: number, roll: number): Item {
  const w = weights(place);
  const total = w.boost + w.blob + w.orb;
  const at = roll * total;
  return at < w.boost ? 'boost' : at < w.boost + w.blob ? 'blob' : 'orb';
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }, reach: number) => Math.hypot(a.x - b.x, a.y - b.y) < reach;

/** A kart that spins out: it drops to 30% of its speed and takes no input for a second. A kart already spinning is not hit twice. */
function spun(r: Racer): Racer {
  return r.fx.spin > 0 ? r : { kart: { ...r.kart, speed: r.kart.speed * RULES.spinSpeed }, fx: { ...r.fx, spin: RULES.spinTime } };
}

/** What a racer does with its item: a BOOST starts, a BLOB drops behind it, an ORB flies off ahead. A spinning racer, or one holding nothing, does nothing. */
export function useItem(world: World, r: Racer): { world: World; racer: Racer } {
  const { item } = r.fx;
  if (!item || r.fx.spin > 0) return { world, racer: r };
  const { kart } = r;
  const racer = { ...r, fx: { ...r.fx, item: null } };
  if (item === 'boost') return { world, racer: { ...racer, fx: { ...racer.fx, boost: RULES.boostTime } } };
  const [cos, sin] = [Math.cos(kart.angle), Math.sin(kart.angle)];
  if (item === 'blob') {
    const blobs = [...world.blobs, { x: kart.x - cos * RULES.blobBehind, y: kart.y - sin * RULES.blobBehind }].slice(-RULES.blobMax);
    return { world: { ...world, blobs }, racer };
  }
  const orb = { x: kart.x + cos * RULES.orbAhead, y: kart.y + sin * RULES.orbAhead, angle: kart.angle, bounces: 0, age: 0 };
  return { world: { ...world, orbs: [...world.orbs, orb] }, racer };
}

/** One ORB after `dt` seconds: straight on at twice the top speed, turned back at a wall; null once it is gone (a third bounce, or its life). */
function flyOrb(map: readonly string[], o: Orb, dt: number): Orb | null {
  const speed = RULES.topSpeed * RULES.orbSpeed * dt;
  let dx = Math.cos(o.angle) * speed, dy = Math.sin(o.angle) * speed;
  let bounces = o.bounces;
  const wall = (x: number, y: number) => tileAt(map, Math.floor(x / TILE), Math.floor(y / TILE)) === 'X';
  if (wall(o.x + dx, o.y)) { dx = -dx; bounces++; }
  if (wall(o.x, o.y + dy)) { dy = -dy; bounces++; }
  if (wall(o.x + dx, o.y + dy)) { dx = -dx; dy = -dy; bounces++; }
  const age = o.age + dt;
  if (bounces >= RULES.orbBounces || age >= RULES.orbLife) return null;
  return { x: o.x + dx, y: o.y + dy, angle: Math.atan2(dy, dx), bounces, age };
}

/**
 * `dt` seconds of the items: boxes come back, a kart driving through a box that holds nothing takes the
 * item its place draws, the first kart over a BLOB spins out and the BLOB is gone, and ORBs fly, bouncing
 * off walls, until one hits a kart (which spins out). `places[i]` is racer i's place, 1 to 6.
 */
export function stepItems(map: readonly string[], world: World, racers: readonly Racer[], places: readonly number[], dt: number): { world: World; racers: Racer[] } {
  let rng = world.rng;
  const out = racers.map((r) => r);
  const boxes = world.boxes.map((b) => ({ ...b, back: Math.max(0, b.back - dt) }));
  for (const box of boxes) {
    if (box.back > 0) continue;
    const i = out.findIndex((r) => !r.fx.item && near(r.kart, box, RULES.boxReach));
    const taker = out[i];
    if (!taker) continue;
    const [roll, next] = draw(rng);
    rng = next;
    out[i] = { ...taker, fx: { ...taker.fx, item: itemFor(places[i] ?? 6, roll) } };
    box.back = RULES.boxBack;
  }
  let blobs = world.blobs;
  for (const blob of world.blobs) {
    const i = out.findIndex((r) => r.fx.spin <= 0 && near(r.kart, blob, RULES.blobReach));
    const hit = out[i];
    if (!hit) continue;
    out[i] = spun(hit);
    blobs = blobs.filter((b) => b !== blob);
  }
  const orbs: Orb[] = [];
  for (const orb of world.orbs) {
    const flown = flyOrb(map, orb, dt);
    if (!flown) continue;
    const i = out.findIndex((r) => near(r.kart, flown, RULES.orbReach));
    const hit = out[i];
    if (hit) out[i] = spun(hit); // the orb is gone with the hit
    else orbs.push(flown);
  }
  return { world: { boxes, blobs, orbs, rng }, racers: out };
}

/** Whether rival `i` uses what it holds now, by plain rules: BOOST on a straight, BLOB with a kart close behind, ORB with a kart ahead in range and in line. `straight`: it is facing where it goes. */
export function wantsToUse(racers: readonly Racer[], i: number, straight: boolean): boolean {
  const me = racers[i];
  if (!me?.fx.item || me.fx.spin > 0) return false;
  if (me.fx.item === 'boost') return straight;
  const [cos, sin] = [Math.cos(me.kart.angle), Math.sin(me.kart.angle)];
  return racers.some((o, j) => {
    if (j === i) return false;
    const dx = o.kart.x - me.kart.x, dy = o.kart.y - me.kart.y;
    const along = dx * cos + dy * sin, side = -dx * sin + dy * cos;
    if (me.fx.item === 'blob') return along < 0 && -along < RULES.blobBehindRange && Math.abs(side) < RULES.blobLateral;
    return along > 0 && along < RULES.orbRange && Math.abs(Math.atan2(side, along)) < RULES.orbLine;
  });
}
