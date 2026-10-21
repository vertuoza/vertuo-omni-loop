// The other five karts, and the race's counting (PRD 1359, slice 3): the rivals driving the racing
// line, karts pushing each other apart, laps counted along the line and places read from the progress
// along it. Pure and seeded, like race.ts, which plays all of it.
import type { Tint } from '@omni/design';
import { at } from 'omni-loop/kit/lib/narrow.ts';
import { airborne, leanOf, NO_FX, stepFx, type Fx, type Kart, type Pad } from './kart';
import type { KartLook } from './look';
import { slopeAt } from './relief';
import { RULES, type Difficulty } from './rules';
import { carryAlong, LAPS, locatePx, pointAtPx, roadAt, TILE, tileAt, type Track } from './track';

/** Who drives a rival's kart: its sprite and its tint, as `fleetSprite` gives them, and its fleet's colour, which the kart takes. */
export interface Driver { sprite: string; tint: Tint | null; color: string | null; /** The kart's look (PRD 1762); none draws the fleet's colour and CLASSIC. */ look?: KartLook; /** Who it is, as the results table names it. */ name?: string }

/** How far a kart is in the race: the laps it has completed, and the waypoints of the lap it is on that it has passed in order. */
export interface Pace { laps: number; passed: number }

/** A rival: its driver, its kart, where it is in the race, how fast it can go (a share of the player's top speed) and how far it drives off the line. */
export interface Rival { driver: Driver; kart: Kart; pace: Pace; skill: number; offset: number; /** How long it has held its item, in seconds (items.ts `wantsToUse`). */ held?: number; /** What it holds and what is on it (items.ts); none while it is plain. */ fx?: Fx; /** The race clock at which it crossed the line at the end of the last lap; none while it races. */ doneAt?: number | null;
  /** A remote player in a MULTI race (PRD 1572): who they are, and the state last heard from them (their kart and what is on it) with the race clock it came at. Their kart is read from it, carried forward, and never driven. */
  id?: string; /** Their place on the grid, 0 on pole: a tie in progress goes to the one who started ahead. */ slot?: number; heard?: { kart: Kart; fx: Fx; at: number } }

export const START_PACE: Pace = Object.freeze({ laps: 0, passed: 0 });

/** One draw of a seeded generator (mulberry32): a number in [0, 1), and the next state. */
export function draw(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** `count` skills and offsets for the rivals, from the seed: the same seed, the same rivals. */
export function rivalTraits(seed: number, count: number, level: Difficulty = 'normal'): { skill: number; offset: number }[] {
  const L = RULES.levels[level];
  let state = seed | 0;
  const out: { skill: number; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    const [a, s1] = draw(state);
    const [b, s2] = draw(s1);
    state = s2;
    out.push({ skill: L.skillMin + (L.skillMax - L.skillMin) * a, offset: (b * 2 - 1) * L.lineOffset });
  }
  return out;
}

/** The gates' places along a lap, each measured from the start line in game pixels (0 at the line, `track.length` back at it), in the order they are passed. */
const gateRels = new WeakMap<Track, readonly number[]>();
function gatesOfLap(track: Track): readonly number[] {
  const known = gateRels.get(track);
  if (known) return known;
  const made = track.gates.map((g) => mod(g.along - track.startAlong, track.length));
  gateRels.set(track, made);
  return made;
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** How far along the lap a kart is, in game pixels from the start line, read from the nearest point of the centre line: the one of the two laps nearest to where the next gate stands (so the grid, behind the line, starts below zero). */
function relOf(track: Track, pace: Pace, kart: { x: number; y: number; along?: number }): number {
  const rel = mod(locatePx(track, kart.x, kart.y, kart.along).along - track.startAlong, track.length);
  const gates = gatesOfLap(track);
  const next = pace.passed >= gates.length ? track.length : (gates[pace.passed] ?? 0);
  return Math.abs(rel - track.length - next) < Math.abs(rel - next) ? rel - track.length : rel;
}

/** Progress along the racing line in game pixels: whole laps, then the way along the centre line from the start line. Places follow it. */
export function progressOf(track: Track, pace: Pace, kart: { x: number; y: number; along?: number }): number {
  return pace.laps * track.length + relOf(track, pace, kart);
}

/** Whether the step `from` -> `to` went through the gate of a waypoint forwards: it crossed the line normal to the centre line at the middle of its arc, within the road's width (and `RULES.gateSlack` beyond it, over the void on the inside of a bend too). */
function throughGate(gate: Track['gates'][number], from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  const s0 = (from.x - gate.x) * gate.tx + (from.y - gate.y) * gate.ty, s1 = (to.x - gate.x) * gate.tx + (to.y - gate.y) * gate.ty;
  // Over the line this step, or just past it: a kart pushed across by another between two steps is no less through (the slab is a few pixels).
  const crossed = s0 < 0 && s1 >= 0;
  if (!crossed && !(s1 >= 0 && s1 < RULES.gateSlab && s0 >= 0 && s0 < RULES.gateSlab)) return false;
  const k = crossed ? s0 / (s0 - s1) : 1, px = from.x + (to.x - from.x) * k, py = from.y + (to.y - from.y) * k;
  const lateral = Math.abs((px - gate.x) * -gate.ty + (py - gate.y) * gate.tx);
  return lateral <= Math.hypot(gate.bx - gate.ax, gate.by - gate.ay) / 2 + RULES.gateSlack;
}

/** The pace after a kart moved `from` -> `to`: the next waypoint passed when it goes through its gate (the middle of its arc), a lap when the line is crossed forwards after every waypoint. */
export function advance(track: Track, pace: Pace, from: { x: number; y: number }, to: { x: number; y: number }): Pace {
  const n = track.gates.length;
  const [fx, fy] = track.forward;
  if (pace.passed >= n) {
    const before = from.x * fx + from.y * fy - track.line.at, after = to.x * fx + to.y * fy - track.line.at;
    if (before < 0 && after >= 0) return { laps: pace.laps + 1, passed: 0 };
    return pace;
  }
  const skipped = crossedGate(track, pace.passed, from, to);
  if (skipped) return { laps: pace.laps, passed: pace.passed + 2 };
  return throughGate(at(track.gates, pace.passed, 'a gate'), from, to) ? { laps: pace.laps, passed: pace.passed + 1 } : pace;
}

/** Whether the step `from` -> `to` crosses the segment `a` -> `b`, and on which side it ends: 1 when it ends to the left of a -> b's direction of travel, -1 to the right, 0 when it does not cross. */
function crossing(from: { x: number; y: number }, to: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const side = (p: { x: number; y: number }) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const s0 = side(from), s1 = side(to);
  if (!(s0 < 0 && s1 >= 0) && !(s0 >= 0 && s1 < 0)) return 0;
  const k = s0 / (s0 - s1), px = from.x + (to.x - from.x) * k, py = from.y + (to.y - from.y) * k;
  const along = ((px - a.x) * (b.x - a.x) + (py - a.y) * (b.y - a.y)) / (Math.hypot(b.x - a.x, b.y - a.y) ** 2 || 1);
  if (along < 0 || along > 1) return 0;
  return s1 >= 0 ? 1 : -1;
}

/**
 * Whether a kart moving `from` -> `to` crossed, forwards (the way its leg runs), the gate of a shortcut that skips the
 * waypoint `next` and the one after it (PRD 1775): a gate credits its two waypoints only when the first of them is the
 * next to pass.
 */
function crossedGate(track: Track, next: number, from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  return track.shortcuts.some((s) => {
    if (s.skips !== next) return false;
    const [a, b] = s.gate;
    const side = crossing(from, to, a, b);
    if (side === 0) return false;
    const sign = (b.x - a.x) * (s.to.y - s.from.y) - (b.y - a.y) * (s.to.x - s.from.x); // which side of the gate the leg runs on
    return side * sign > 0;
  });
}

/** Whether a kart moving `from` -> `to` crossed any gate, either way: what a rival never does. */
export function crossedAnyGate(track: Track, from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  return track.shortcuts.some((s) => crossing(from, to, s.gate[0], s.gate[1]) !== 0);
}

/** The lap a kart is on, 1 to `laps` (3 unless the race runs more): the one it is racing, and the last one once the rest are done. */
export const lapOf = (pace: Pace, laps: number = LAPS): number => Math.min(pace.laps + 1, laps);

const turn = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** How far a rival's kart must turn to face the point it aims at: a point of the centre line `RULES.rivalAhead` seconds of its speed ahead of the kart (at least `RULES.rivalAheadMin`), off the line by its offset (radians, positive to the right). The racing line follows the arcs, so a rival aims along them. */
export function aimOf(track: Track, r: Rival): number {
  const here = locatePx(track, r.kart.x, r.kart.y, r.kart.along);
  const ahead = Math.max(RULES.rivalAheadMin, RULES.rivalAhead * Math.max(0, r.kart.speed));
  const w = pointAtPx(track, here.along + ahead);
  const tx = w.x - w.ty * r.offset, ty = w.y + w.tx * r.offset;
  return turn(Math.atan2(ty - r.kart.y, tx - r.kart.x) - r.kart.angle);
}

/** The arcs of the centre line, in game pixels along it: where each starts and ends, and its radius. */
const arcsOfLine = new WeakMap<Track, readonly { start: number; end: number; radius: number }[]>();
function arcsOf(track: Track): readonly { start: number; end: number; radius: number }[] {
  const known = arcsOfLine.get(track);
  if (known) return known;
  const made = track.centre.segments.flatMap((s) => (s.kind === 'arc' ? [{ start: s.start * TILE, end: (s.start + s.len) * TILE, radius: s.r * TILE }] : []));
  arcsOfLine.set(track, made);
  return made;
}

/** The speed a kart can take a turn of `radius` pixels at, with `RULES.rivalCurve` of it in hand: the radius it turns on at that speed (`speed / turnRate`) is that of the turn. Never over the top speed. */
function curveSpeed(radius: number): number {
  const R = radius * RULES.rivalCurve;
  return Math.min(RULES.topSpeed, (RULES.steer * R) / (1 + (RULES.steer * (1 - RULES.steerAtTop) * R) / RULES.topSpeed));
}

/** The speed a rival may carry now: that of the tightest arc it is in or `RULES.rivalHorizon` ahead of it (the distance, and seconds of its speed), its offset off the line taking from the radius on the inside. */
function speedCap(track: Track, r: Rival): number {
  const along = locatePx(track, r.kart.x, r.kart.y, r.kart.along).along;
  const reach = RULES.rivalHorizon + RULES.rivalHorizonTime * Math.max(0, r.kart.speed);
  let cap = Infinity;
  for (const arc of arcsOf(track)) {
    for (const shift of [0, track.length, -track.length]) {
      if (arc.end + shift <= along || arc.start + shift >= along + reach) continue;
      cap = Math.min(cap, curveSpeed(Math.max(1, arc.radius - Math.abs(r.offset))));
    }
  }
  return cap;
}

/** Whether a turn tighter than `RULES.rivalDriftRadius` is under the kart or within its look ahead (PRD 1963): the bend a HARD rival hops into and drifts through, until it opens past that radius. */
function tightAhead(track: Track, r: Rival): boolean {
  const along = locatePx(track, r.kart.x, r.kart.y, r.kart.along).along;
  const reach = RULES.rivalHorizon + RULES.rivalHorizonTime * Math.max(0, r.kart.speed);
  const tight = RULES.rivalDriftRadius * TILE;
  return arcsOf(track).some((arc) => arc.radius < tight && [0, track.length, -track.length].some((shift) => arc.end + shift > along && arc.start + shift < along + reach));
}

/** Whether a HARD rival holds HOP now (PRD 1963): on the ground, not braking, fast enough or already drifting, with a tight bend under it or in its look. */
function holdsHop(track: Track, r: Rival, level: Difficulty, pad: Pad): boolean {
  if (level !== 'hard' || pad.brake || airborne(r.kart)) return false;
  return (r.kart.speed >= RULES.driftMin * RULES.topSpeed || r.fx?.drift !== undefined) && tightAhead(track, r);
}

/** Whether a ramp is under the kart or on its way in the next `ahead` units (PRD 1775): the gap beyond it is to be jumped, not steered away from. */
function rampAhead(track: Track, k: { x: number; y: number; angle: number }, ahead: number): boolean {
  for (let d = 0; d <= ahead + TILE / 2; d += TILE / 2) {
    const tx = Math.floor((k.x + Math.cos(k.angle) * Math.min(d, ahead)) / TILE), ty = Math.floor((k.y + Math.sin(k.angle) * Math.min(d, ahead)) / TILE);
    if (tileAt(track.map, tx, ty) === '^') return true;
  }
  return false;
}

/** Whether a kart is on the way to a ramp: one within `RULES.rampCalm` ahead of it, where no item is thrown. */
export const approachesRamp = (track: Track, k: { x: number; y: number; angle: number }): boolean => rampAhead(track, k, RULES.rampCalm);

/** What a rival's hands do: steer at the point it aims at, and lift for a turn it cannot take at its speed. A wheel over the void, now or `RULES.rivalLook` seconds ahead, steers it back from the edge with the gas off (but for a crawl under `RULES.rivalCrawl`, so a stalled kart pulls clear), and brakes it when it is faster than a corner allows. */
function rivalPad(track: Track, r: Rival, level: Difficulty = 'normal'): Pad {
  const { x, y, angle, speed } = r.kart;
  const ahead = RULES.rivalLook * Math.max(0, speed);
  const flying = airborne(r.kart); // in the air nothing is under the wheels to steer from
  const lean = flying ? 0 : leanOf(track, r.kart) || (rampAhead(track, r.kart, ahead) ? 0 : leanOf(track, { x: x + Math.cos(angle) * ahead, y: y + Math.sin(angle) * ahead, angle }));
  if (lean !== 0) return { left: lean > 0, right: lean < 0, accel: speed < RULES.rivalCrawl, brake: speed > RULES.rivalCorner };
  const diff = aimOf(track, r);
  const cap = speedCap(track, r);
  const pad: Pad = { left: diff < -RULES.rivalAim, right: diff > RULES.rivalAim, accel: speed <= cap, brake: speed > cap * RULES.rivalBrake };
  // PRD 1963: at HARD only, HOP is held through a bend tighter than `rivalDriftRadius` (a hop at its entry, a drift once it lands, released as the bend opens); never with the void in the look (the lean above).
  return holdsHop(track, r, level, pad) ? { ...pad, hop: true } : pad;
}

/** The rubber band: a rival behind the player speeds up and one far ahead slows down, by at most `RULES.rubber` of its pace. */
export function rubber(rivalProgress: number, playerProgress: number, level: Difficulty = 'normal'): number {
  const gap = Math.max(-1, Math.min(1, (playerProgress - rivalProgress) / RULES.rubberRange));
  return 1 + RULES.levels[level].rubber * gap;
}

/**
 * The kart's way back after its fall (PRD 1447): at rest, on the point of the racing line nearest to where it fell, between the last
 * waypoint passed (its gate) and the next, and never at the next gate nor on the start line, facing the centre line's direction there, blinking.
 * Its `Pace` is not touched: the jump is never passed to `advance()`. Where that point is over the void, a gap across the line (bug 1820), the way
 * back is behind the gap by `RULES.runUp`, so that from rest the kart can clear it, and never before the gate it passed.
 */
export function comeBack(track: Track, pace: Pace, kart: Kart, fx: Fx): { kart: Kart; fx: Fx } {
  const gates = gatesOfLap(track);
  const lo = pace.passed <= 0 ? 0 : (gates[Math.min(pace.passed, gates.length) - 1] ?? 0);
  const hi = pace.passed >= gates.length ? track.length : (gates[pace.passed] ?? track.length);
  const spot = (s: number) => pointAtPx(track, track.startAlong + s);
  const roadAlong = (s: number) => roadAt(track, spot(s).x, spot(s).y);
  /** From `s` back along the centre line to the first point over road, the gate at most. */
  const toRoad = (s: number) => { let t = s; while (t > lo && !roadAlong(t)) t = Math.max(lo, t - 1); return t; };
  const nearest = Math.min(Math.max(lo, hi - 1), Math.max(lo + 1, relOf(track, pace, kart)));
  const along = roadAlong(nearest) ? nearest : toRoad(Math.max(lo, toRoad(nearest) - RULES.runUp));
  const p = spot(along);
  return {
    kart: carryAlong(track, { along: p.along }, { x: p.x, y: p.y, angle: Math.atan2(p.ty, p.tx), speed: 0, steer: 0 }),
    fx: { ...fx, fall: 0, blink: RULES.blinkTime },
  };
}

/** One short step of a rival, the player being `playerProgress` along: it drives its kart at its own pace, and its pace follows. A rival whose fall ends comes back on the line. */
export function driveRival(track: Track, r: Rival, dt: number, playerProgress: number, level: Difficulty = 'normal'): Rival {
  const band = rubber(progressOf(track, r.pace, r.kart), playerProgress, level);
  const stepped = stepFx(track, r.kart, rivalPad(track, r, level), dt, r.skill * band, r.fx ?? NO_FX, slopeAt(track, r.kart.x, r.kart.y, r.kart.angle));
  const pace = advance(track, r.pace, r.kart, stepped.kart);
  const kart = carryAlong(track, r.kart, stepped.kart);
  if (!stepped.landed) return { ...r, kart, fx: stepped.fx, pace };
  return { ...r, ...comeBack(track, pace, kart, stepped.fx), pace };
}

/** Two karts that touch are pushed apart, as two circles, each by half of how deep they overlap; a kart marked in `falling` touches none, and one in the air is touched only by another in the air. */
export function pushApart(karts: readonly Kart[], falling: readonly boolean[] = []): Kart[] {
  const out = karts.map((k) => ({ ...k }));
  const reach = RULES.radius * 2;
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = at(out, i, 'a kart'), b = at(out, j, 'a kart');
      if (falling[i] || falling[j] || airborne(a) !== airborne(b)) continue; // a falling kart is out of the contacts, and a kart on the ground does not push one in the air
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= reach) continue;
      const [nx, ny] = d > 0 ? [dx / d, dy / d] : [1, 0];
      const half = (reach - d) / 2;
      out[i] = { ...a, x: a.x - nx * half, y: a.y - ny * half };
      out[j] = { ...b, x: b.x + nx * half, y: b.y + ny * half };
    }
  }
  return out;
}
