// The other five karts, and the race's counting (PRD 1359, slice 3): the rivals driving the racing
// line, karts pushing each other apart, laps counted along the line and places read from the progress
// along it. Pure and seeded, like race.ts, which plays all of it.
import type { Tint } from '@omni/design';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { airborne, leanOf, NO_FX, stepFx, type Fx, type Kart, type Pad } from './kart';
import type { KartLook } from './look';
import { slopeAt } from './relief';
import { RULES, type Difficulty } from './rules';
import { LAPS, TILE, tileAt, type Track } from './track';

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

/** The racing line as a closed polyline: the start line's middle, then the waypoints, then back to it; with the length up to each point. */
interface Line { pts: readonly { x: number; y: number }[]; cum: readonly number[]; length: number }
const lines = new WeakMap<Track, Line>();
function lineOf(track: Track): Line {
  const known = lines.get(track);
  if (known) return known;
  const pts = [{ x: track.line.x, y: track.line.y }, ...track.waypoints, { x: track.line.x, y: track.line.y }];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = at(pts, i - 1, 'a point'), b = at(pts, i, 'a point');
    cum.push(at(cum, i - 1, 'a length') + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const made = { pts, cum, length: at(cum, cum.length - 1, 'the line\'s length') };
  lines.set(track, made);
  return made;
}

/** The segment of the racing line a kart with this pace is measured along: its index, its first point, its direction (dx, dy) and its length. */
function segmentOf(track: Track, pace: Pace) {
  const { pts } = lineOf(track);
  const i = Math.min(pace.passed, pts.length - 2);
  const a = at(pts, i, 'a point'), b = at(pts, i + 1, 'a point');
  const dx = b.x - a.x, dy = b.y - a.y;
  return { i, a, dx, dy, len: Math.hypot(dx, dy) || 1 };
}

/** Progress along the racing line in game pixels: whole laps, then the way along the segment the kart is on. Places follow it. */
export function progressOf(track: Track, pace: Pace, kart: { x: number; y: number }): number {
  const { cum, length } = lineOf(track);
  const { i, a, dx, dy, len } = segmentOf(track, pace);
  const back = kart.x * track.forward[0] + kart.y * track.forward[1] - track.line.at;
  if (pace.laps === 0 && pace.passed === 0 && back < 0) return back; // the grid stands behind the line: progress starts below zero
  const along = Math.min(len, Math.max(0, ((kart.x - a.x) * dx + (kart.y - a.y) * dy) / len));
  return pace.laps * length + at(cum, i, 'a length') + along;
}

/** The pace after a kart moved `from` -> `to`: the next waypoint passed when it comes within reach or goes through its corner, a lap when the line is crossed forwards after every waypoint. */
export function advance(track: Track, pace: Pace, from: { x: number; y: number }, to: { x: number; y: number }): Pace {
  const n = track.waypoints.length;
  const [fx, fy] = track.forward;
  if (pace.passed >= n) {
    const before = from.x * fx + from.y * fy - track.line.at, after = to.x * fx + to.y * fy - track.line.at;
    if (before < 0 && after >= 0) return { laps: pace.laps + 1, passed: 0 };
    return pace;
  }
  const skipped = crossedGate(track, pace.passed, from, to);
  if (skipped) return { laps: pace.laps, passed: pace.passed + 2 };
  const w = at(track.waypoints, pace.passed, 'a waypoint');
  const passed = Math.hypot(to.x - w.x, to.y - w.y) < RULES.waypointReach || throughCorner(track, pace.passed, from, to);
  return passed ? { laps: pace.laps, passed: pace.passed + 1 } : pace;
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

/**
 * Whether a kart moving `from` -> `to` went through waypoint `i`'s corner: it crossed the corner's
 * diagonal forwards (the line through the waypoint halfway between the way in and the way out), within
 * `RULES.cornerGate` of the waypoint. A kart cutting the corner on the inside, over the grass too, never
 * comes within reach of the waypoint, but it crosses the diagonal.
 */
function throughCorner(track: Track, i: number, from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  const { pts } = lineOf(track);
  const a = at(pts, i, 'a point'), w = at(pts, i + 1, 'a point'), b = at(pts, i + 2, 'a point');
  const lin = Math.hypot(w.x - a.x, w.y - a.y) || 1, lout = Math.hypot(b.x - w.x, b.y - w.y) || 1;
  const gx = (w.x - a.x) / lin + (b.x - w.x) / lout, gy = (w.y - a.y) / lin + (b.y - w.y) / lout;
  const before = (from.x - w.x) * gx + (from.y - w.y) * gy, after = (to.x - w.x) * gx + (to.y - w.y) * gy;
  if (!(before < 0 && after >= 0)) return false;
  const k = before / (before - after);
  return Math.hypot(from.x + (to.x - from.x) * k - w.x, from.y + (to.y - from.y) * k - w.y) < RULES.cornerGate;
}

/** The lap a kart is on, 1 to `laps` (3 unless the race runs more): the one it is racing, and the last one once the rest are done. */
export const lapOf = (pace: Pace, laps: number = LAPS): number => Math.min(pace.laps + 1, laps);

const turn = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The step (dx, dy) from a kart to waypoint `i`. */
const pointOf = (track: Track, i: number, kart: { x: number; y: number }): [number, number] => {
  const w = at(track.waypoints, i, 'a waypoint');
  return [w.x - kart.x, w.y - kart.y];
};

/** How far a rival's kart must turn to face the point it aims at: the next waypoint, off the line by its offset (radians, positive to the right). Within `RULES.rivalTurnIn` of a corner's waypoint it aims at the one after it (PRD 1698), so it takes the corner on the road. */
export function aimOf(track: Track, r: Rival): number {
  const n = track.waypoints.length;
  const near = r.pace.passed < n - 1 && Math.hypot(...pointOf(track, r.pace.passed, r.kart)) < RULES.rivalTurnIn;
  const i = r.pace.passed + (near ? 1 : 0);
  const w = i < n
    ? at(track.waypoints, i, 'a waypoint')
    : { x: track.line.x + track.forward[0] * 3 * RULES.waypointReach, y: track.line.y + track.forward[1] * 3 * RULES.waypointReach };
  const from = i === 0 ? track.line : at(track.waypoints, Math.min(i, n) - 1, 'a waypoint');
  const dx = w.x - from.x, dy = w.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const tx = w.x - (dy / len) * r.offset, ty = w.y + (dx / len) * r.offset;
  return turn(Math.atan2(ty - r.kart.y, tx - r.kart.x) - r.kart.angle);
}

/** Whether a ramp is under the kart or on its way in the next `ahead` units (PRD 1775): the gap beyond it is to be jumped, not steered away from. */
function rampAhead(track: Track, k: { x: number; y: number; angle: number }, ahead: number): boolean {
  for (let d = 0; d <= ahead + TILE / 2; d += TILE / 2) {
    const tx = Math.floor((k.x + Math.cos(k.angle) * Math.min(d, ahead)) / TILE), ty = Math.floor((k.y + Math.sin(k.angle) * Math.min(d, ahead)) / TILE);
    if (tileAt(track.map, tx, ty) === '^') return true;
  }
  return false;
}

/** What a rival's hands do: steer at the point it aims at, and ease off in a sharp turn. A wheel over the void, now or `RULES.rivalLook` seconds ahead, steers it back from the edge with the gas off (but for a crawl under `RULES.rivalCrawl`, so a stalled kart pulls clear), and brakes it when it is faster than a corner allows. */
function rivalPad(track: Track, r: Rival): Pad {
  const { x, y, angle, speed } = r.kart;
  const ahead = RULES.rivalLook * Math.max(0, speed);
  const flying = airborne(r.kart); // in the air nothing is under the wheels to steer from
  const lean = flying ? 0 : leanOf(track.map, r.kart) || (rampAhead(track, r.kart, ahead) ? 0 : leanOf(track.map, { x: x + Math.cos(angle) * ahead, y: y + Math.sin(angle) * ahead, angle }));
  if (lean !== 0) return { left: lean > 0, right: lean < 0, accel: speed < RULES.rivalCrawl, brake: speed > RULES.rivalCorner };
  const diff = aimOf(track, r);
  const sharp = Math.abs(diff) > RULES.rivalSharp && r.kart.speed > RULES.rivalCorner;
  return { left: diff < -RULES.rivalAim, right: diff > RULES.rivalAim, accel: !sharp, brake: sharp && Math.abs(diff) > RULES.rivalSharp * 1.6 };
}

/** The rubber band: a rival behind the player speeds up and one far ahead slows down, by at most `RULES.rubber` of its pace. */
export function rubber(rivalProgress: number, playerProgress: number, level: Difficulty = 'normal'): number {
  const gap = Math.max(-1, Math.min(1, (playerProgress - rivalProgress) / RULES.rubberRange));
  return 1 + RULES.levels[level].rubber * gap;
}

/**
 * The kart's way back after its fall (PRD 1447): at rest, on the point of the racing line nearest to where it fell, on the
 * segment `progressOf()` measures it along and never at that segment's ends (never at the next waypoint, never on the start
 * line), facing the segment's direction, blinking. Its `Pace` is not touched: the jump is never passed to `advance()`.
 */
export function comeBack(track: Track, pace: Pace, kart: Kart, fx: Fx): { kart: Kart; fx: Fx } {
  const { a, dx, dy, len } = segmentOf(track, pace);
  const along = Math.min(Math.max(0, len - 1), Math.max(0, ((kart.x - a.x) * dx + (kart.y - a.y) * dy) / len));
  return {
    kart: { x: a.x + (dx / len) * along, y: a.y + (dy / len) * along, angle: Math.atan2(dy, dx), speed: 0, steer: 0 },
    fx: { ...fx, fall: 0, blink: RULES.blinkTime },
  };
}

/** One short step of a rival, the player being `playerProgress` along: it drives its kart at its own pace, and its pace follows. A rival whose fall ends comes back on the line. */
export function driveRival(track: Track, r: Rival, dt: number, playerProgress: number, level: Difficulty = 'normal'): Rival {
  const band = rubber(progressOf(track, r.pace, r.kart), playerProgress, level);
  const stepped = stepFx(track.map, r.kart, rivalPad(track, r), dt, r.skill * band, r.fx ?? NO_FX, slopeAt(track, r.kart.x, r.kart.y, r.kart.angle));
  const pace = advance(track, r.pace, r.kart, stepped.kart);
  if (!stepped.landed) return { ...r, kart: stepped.kart, fx: stepped.fx, pace };
  return { ...r, ...comeBack(track, pace, stepped.kart, stepped.fx), pace };
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
