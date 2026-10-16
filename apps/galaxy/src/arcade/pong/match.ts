// OMNI PONG's match against the AI: pure and seeded, no DOM, no clock of its own. `step` plays the time
// since the last frame in fixed sub-steps, carrying the remainder, so the same seed and steering give the
// same match at 60 or 120 frames a second. A point is scored when the AI misses; a point conceded costs a
// life and never adds; the third conceded ends the match, and the move into `over` is told once.
import { MATCH } from './rules';
import type { Steer } from './steer';

export type Side = 'player' | 'ai';

/** Where the match stands: the ball waiting at the centre, in play, or over. */
export type MatchPhase = 'serve' | 'play' | 'over';

export interface Ball { readonly x: number; readonly y: number; readonly vx: number; readonly vy: number }

export interface Match {
  readonly phase: MatchPhase;
  /** The seeded generator's state: every serve's angle is drawn from it. */
  readonly rng: number;
  readonly ball: Ball;
  /** The ball's speed in this rally: the serve speed, raised by every return up to the cap. */
  readonly speed: number;
  /** The centres of the player's paddle (left) and the AI's (right), down from the top. */
  readonly player: number;
  readonly ai: number;
  /** The ball's height over the last sub-steps, newest first: the AI plays the oldest, its delay late. */
  readonly seen: readonly number[];
  /** Points scored: one per AI miss. */
  readonly score: number;
  readonly lives: number;
  /** The sub-steps left before the serve, and the side it goes toward: the side that conceded. */
  readonly wait: number;
  readonly toward: Side;
  /** The time played that is shorter than a sub-step, carried to the next call. */
  readonly carry: number;
}

/** A serve, the ball off a wall, off a paddle, a point scored (the AI missed), a point conceded, the match ended. */
export type MatchEvent = 'serve' | 'wall' | 'return' | 'point' | 'conceded' | 'over';

export interface Played { match: Match; events: readonly MatchEvent[] }

const WAIT_STEPS = Math.round(MATCH.serveSeconds / MATCH.subStep);
const LAG_STEPS = Math.round(MATCH.ai.delay / MATCH.subStep);
const HALF_PADDLE = MATCH.paddle.h / 2;
const HALF_BALL = MATCH.ball / 2;
const CENTRE = Object.freeze({ x: MATCH.field.w / 2, y: MATCH.field.h / 2 });
const STILL_BALL: Ball = Object.freeze({ x: CENTRE.x, y: CENTRE.y, vx: 0, vy: 0 });
// A sum of frames that lands on a whole sub-step is one: the float error of the carry never drops it.
const EPSILON = 1e-9;

/** The x of a side's paddle centre. */
export const paddleX = (side: Side): number => (side === 'player' ? MATCH.paddle.inset : MATCH.field.w - MATCH.paddle.inset);

/** One draw of a small seeded generator (mulberry32): a number in [0, 1) and the state after it. */
function draw(state: number): { value: number; rng: number } {
  const rng = (state + 0x6d2b79f5) >>> 0;
  let t = rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, rng };
}

export function newMatch({ seed }: { seed: number }): Match {
  return {
    phase: 'serve', rng: seed >>> 0, ball: STILL_BALL, speed: MATCH.serveSpeed, player: CENTRE.y, ai: CENTRE.y, seen: [],
    score: 0, lives: MATCH.lives, wait: WAIT_STEPS, toward: 'player', carry: 0,
  };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const onField = (y: number): number => clamp(y, HALF_PADDLE, MATCH.field.h - HALF_PADDLE);

/** The ball served from the centre toward `toward`, at the serve speed and an angle drawn from the match's seed. */
function serve(m: Match): Match {
  const a = draw(m.rng), b = draw(a.rng);
  const angle = (MATCH.serveAngle.min + a.value * (MATCH.serveAngle.max - MATCH.serveAngle.min)) * (b.value < 0.5 ? -1 : 1);
  const dir = m.toward === 'player' ? -1 : 1;
  const ball = { x: CENTRE.x, y: CENTRE.y, vx: dir * MATCH.serveSpeed * Math.cos(angle), vy: MATCH.serveSpeed * Math.sin(angle) };
  return { ...m, phase: 'play', rng: b.rng, ball, speed: MATCH.serveSpeed };
}

/** The ball off `side`'s paddle centred at `y`: faster by the factor up to the cap, turned by where it struck. */
function returned(ball: Ball, speed: number, side: Side, y: number): { ball: Ball; speed: number } {
  const next = Math.min(speed * MATCH.speedUp, MATCH.maxSpeed);
  const incoming = Math.atan2(ball.vy, Math.abs(ball.vx));
  const struck = clamp((ball.y - y) / HALF_PADDLE, -1, 1);
  const angle = clamp(incoming + struck * MATCH.english, -MATCH.maxAngle, MATCH.maxAngle);
  const dir = side === 'player' ? 1 : -1;
  const faceX = paddleX(side) + dir * (MATCH.paddle.w / 2 + HALF_BALL);
  return { ball: { x: faceX, y: ball.y, vx: dir * next * Math.cos(angle), vy: next * Math.sin(angle) }, speed: next };
}

/** The match after `side` let the ball past: a point scored or a life lost, then the wait before the serve toward it, or over. */
function missed(m: Match, side: Side): Played {
  const waiting = { ...m, phase: 'serve' as const, ball: STILL_BALL, speed: MATCH.serveSpeed, wait: WAIT_STEPS, toward: side, seen: [] };
  if (side === 'ai') return { match: { ...waiting, score: m.score + 1 }, events: ['point'] };
  const lives = m.lives - 1;
  if (lives <= 0) return { match: { ...waiting, lives: 0, phase: 'over', carry: 0 }, events: ['conceded', 'over'] };
  return { match: { ...waiting, lives }, events: ['conceded'] };
}

/** Whether the ball, moving from `from` to `to`, crossed `side`'s paddle face with the paddle centred at `y` in its way. */
function meets(from: Ball, to: Ball, side: Side, y: number): boolean {
  const face = paddleX(side) + (side === 'player' ? 1 : -1) * (MATCH.paddle.w / 2 + HALF_BALL);
  const crossed = side === 'player' ? from.x >= face && to.x < face : from.x <= face && to.x > face;
  return crossed && Math.abs(to.y - y) <= HALF_PADDLE + HALF_BALL;
}

/** The paddles moved one sub-step: the player's by its steering, the AI's toward the ball as it saw it, its delay late. */
function moved(m: Match, steer: Steer): Match {
  const d = MATCH.playerSpeed * MATCH.subStep;
  const player = steer === 'still' ? m.player : onField(m.player + (steer === 'up' ? -d : d));
  const seen = [m.ball.y, ...m.seen].slice(0, LAG_STEPS);
  const target = seen.length < LAG_STEPS ? m.ai : seen[LAG_STEPS - 1] ?? m.ai;
  const reach = MATCH.ai.speed * MATCH.subStep;
  const ai = onField(m.ai + clamp(target - m.ai, -reach, reach));
  return { ...m, player, ai, seen };
}

/** The ball moved one sub-step, folded back off the top or bottom wall. */
function flown(from: Ball): Ball {
  const ball = { ...from, x: from.x + from.vx * MATCH.subStep, y: from.y + from.vy * MATCH.subStep };
  const top = HALF_BALL, bottom = MATCH.field.h - HALF_BALL;
  if (ball.y < top) return { ...ball, y: 2 * top - ball.y, vy: Math.abs(ball.vy) };
  if (ball.y > bottom) return { ...ball, y: 2 * bottom - ball.y, vy: -Math.abs(ball.vy) };
  return ball;
}

/** The side whose paddle the ball met moving from `from` to `to`, or null. */
function metBy(m: Match, from: Ball, to: Ball): Side | null {
  if (meets(from, to, 'player', m.player)) return 'player';
  if (meets(from, to, 'ai', m.ai)) return 'ai';
  return null;
}

/** The side that let the ball past its edge of the field, or null. */
function pastBy(ball: Ball): Side | null {
  if (ball.x < -HALF_BALL) return 'player';
  if (ball.x > MATCH.field.w + HALF_BALL) return 'ai';
  return null;
}

/** The wait before a serve run down by one sub-step, and the serve once it is out. */
function waited(m: Match): Played {
  const wait = m.wait - 1;
  return wait > 0 ? { match: { ...m, wait }, events: [] } : { match: serve({ ...m, wait: 0 }), events: ['serve'] };
}

/** One sub-step: the paddles move, then the ball, off a wall, off a paddle, or past one. */
function sub(m: Match, steer: Steer): Played {
  const p = moved(m, steer);
  if (p.phase === 'serve') return waited(p);
  const ball = flown(p.ball);
  const events: MatchEvent[] = ball.vy === p.ball.vy ? [] : ['wall'];
  const side = metBy(p, p.ball, ball);
  if (side) {
    const r = returned(ball, p.speed, side, side === 'player' ? p.player : p.ai);
    return { match: { ...p, ball: r.ball, speed: r.speed }, events: [...events, 'return'] };
  }
  const past = pastBy(ball);
  if (past) return missed(p, past);
  return { match: { ...p, ball }, events };
}

/** Plays `dt` seconds (at most `MATCH.maxDt`) with `steer`: whole sub-steps, the rest carried. Over, nothing moves. */
export function step(m: Match, steer: Steer, dt: number): Played {
  if (m.phase === 'over') return { match: m, events: [] };
  let carry = m.carry + Math.min(Math.max(0, dt), MATCH.maxDt);
  let r = m;
  const events: MatchEvent[] = [];
  while (carry >= MATCH.subStep - EPSILON) {
    carry -= MATCH.subStep;
    const s = sub(r, steer);
    r = s.match;
    events.push(...s.events);
    if (r.phase === 'over') return { match: r, events };
  }
  return { match: { ...r, carry: Math.max(0, carry) }, events };
}

/** The match ended where it stands, the score kept (SELECT · QUIT): told once, never again once over. */
export function end(m: Match): Played {
  if (m.phase === 'over') return { match: m, events: [] };
  return { match: { ...m, phase: 'over', carry: 0 }, events: ['over'] };
}
