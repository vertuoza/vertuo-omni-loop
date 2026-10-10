// The other five karts, and the race's counting (PRD 1359, slice 3): the rivals driving the racing
// line, karts pushing each other apart, laps counted along the line and places read from the progress
// along it. Pure and seeded, like race.ts, which plays all of it.
import type { Tint } from '@omni/design';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { NO_FX, stepFx, type Fx, type Kart, type Pad } from './kart';
import { RULES } from './rules';
import { LAPS, type Track } from './track';

/** Who drives a rival's kart: its sprite and its tint, as `fleetSprite` gives them, and its fleet's colour, which the kart takes. */
export interface Driver { sprite: string; tint: Tint | null; color: string | null; /** Who it is, as the results table names it. */ name?: string }

/** How far a kart is in the race: the laps it has completed, and the waypoints of the lap it is on that it has passed in order. */
export interface Pace { laps: number; passed: number }

/** A rival: its driver, its kart, where it is in the race, how fast it can go (a share of the player's top speed) and how far it drives off the line. */
export interface Rival { driver: Driver; kart: Kart; pace: Pace; skill: number; offset: number; /** What it holds and what is on it (items.ts); none while it is plain. */ fx?: Fx; /** The race clock at which it crossed the line at the end of the last lap; none while it races. */ doneAt?: number | null }

export const START_PACE: Pace = Object.freeze({ laps: 0, passed: 0 });

/** One draw of a seeded generator (mulberry32): a number in [0, 1), and the next state. */
export function draw(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** `count` skills and offsets for the rivals, from the seed: the same seed, the same rivals. */
export function rivalTraits(seed: number, count: number): { skill: number; offset: number }[] {
  let state = seed | 0;
  const out: { skill: number; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    const [a, s1] = draw(state);
    const [b, s2] = draw(s1);
    state = s2;
    out.push({ skill: RULES.skillMin + (1 - RULES.skillMin) * a, offset: (b * 2 - 1) * RULES.lineOffset });
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

/** Progress along the racing line in game pixels: whole laps, then the way along the segment the kart is on. Places follow it. */
export function progressOf(track: Track, pace: Pace, kart: { x: number; y: number }): number {
  const { pts, cum, length } = lineOf(track);
  const i = Math.min(pace.passed, pts.length - 2);
  const a = at(pts, i, 'a point'), b = at(pts, i + 1, 'a point');
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
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
  const w = at(track.waypoints, pace.passed, 'a waypoint');
  const passed = Math.hypot(to.x - w.x, to.y - w.y) < RULES.waypointReach || throughCorner(track, pace.passed, from, to);
  return passed ? { laps: pace.laps, passed: pace.passed + 1 } : pace;
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

/** The lap a kart is on, 1 to `LAPS`: the one it is racing, and the third one once two are done. */
export const lapOf = (pace: Pace): number => Math.min(pace.laps + 1, LAPS);

const turn = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** How far a rival's kart must turn to face the point it aims at: the next waypoint, off the line by its offset (radians, positive to the right). */
export function aimOf(track: Track, r: Rival): number {
  const n = track.waypoints.length;
  const i = r.pace.passed;
  const w = i < n
    ? at(track.waypoints, i, 'a waypoint')
    : { x: track.line.x + track.forward[0] * 3 * RULES.waypointReach, y: track.line.y + track.forward[1] * 3 * RULES.waypointReach };
  const from = i === 0 ? track.line : at(track.waypoints, Math.min(i, n) - 1, 'a waypoint');
  const dx = w.x - from.x, dy = w.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const tx = w.x - (dy / len) * r.offset, ty = w.y + (dx / len) * r.offset;
  return turn(Math.atan2(ty - r.kart.y, tx - r.kart.x) - r.kart.angle);
}

/** What a rival's hands do: steer at the point it aims at, and ease off in a sharp turn. */
function rivalPad(track: Track, r: Rival): Pad {
  const diff = aimOf(track, r);
  const sharp = Math.abs(diff) > RULES.rivalSharp && r.kart.speed > RULES.rivalCorner;
  return { left: diff < -RULES.rivalAim, right: diff > RULES.rivalAim, accel: !sharp, brake: sharp && Math.abs(diff) > RULES.rivalSharp * 1.6 };
}

/** The rubber band: a rival behind the player speeds up and one far ahead slows down, by at most `RULES.rubber` of its pace. */
export function rubber(rivalProgress: number, playerProgress: number): number {
  const gap = Math.max(-1, Math.min(1, (playerProgress - rivalProgress) / RULES.rubberRange));
  return 1 + RULES.rubber * gap;
}

/** One short step of a rival, the player being `playerProgress` along: it drives its kart at its own pace, and its pace follows. */
export function driveRival(track: Track, r: Rival, dt: number, playerProgress: number): Rival {
  const band = rubber(progressOf(track, r.pace, r.kart), playerProgress);
  const { kart, fx } = stepFx(track.map, r.kart, rivalPad(track, r), dt, r.skill * band, r.fx ?? NO_FX);
  return { ...r, kart, fx, pace: advance(track, r.pace, r.kart, kart) };
}

/** Two karts that touch are pushed apart, as two circles, each by half of how deep they overlap. */
export function pushApart(karts: readonly Kart[]): Kart[] {
  const out = karts.map((k) => ({ ...k }));
  const reach = RULES.radius * 2;
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = at(out, i, 'a kart'), b = at(out, j, 'a kart');
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
