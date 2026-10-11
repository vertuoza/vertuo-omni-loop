// OMNI DUET's run (PRD 1633): a pure simulation, no DOM, no canvas and no clock of its own. `step`
// plays the time since the last frame in fixed 1/60 s sub-steps, carrying the remainder to the next
// call, so the same inputs give the same run at 60 or at 120 frames a second; `press` answers a
// button. Both return a new run and what happened. Slice 2 holds the ready screen and the turn; the
// blocks, the hits and the score come with the next slices.
import type { Action } from '../keys';
import { RULES, turn } from './rules';

/** The chapters, in the order they are played: each one's numeral and name, as the ready screen says them. */
export const CHAPTERS: readonly { numeral: string; name: string }[] = Object.freeze([
  { numeral: 'I', name: 'DRIFT' },
  { numeral: 'II', name: 'SLIDE' },
  { numeral: 'III', name: 'SPIN' },
  { numeral: 'IV', name: 'STORM' },
]);

/** The lives a run starts with. */
export const LIVES = 3;

/** Where the run stands: on a ready screen, waiting for START, or in play. */
export type Phase = 'ready' | 'play';

export interface Run {
  readonly phase: Phase;
  /** The run's seed: the same seed and inputs give the same run. */
  readonly seed: number;
  /** The chapter being played, an index into `CHAPTERS`. */
  readonly chapter: number;
  readonly lives: number;
  readonly score: number;
  /** The pair's angle, in radians, anticlockwise from the crest's right: the warm orb's; the cool one is opposite. */
  readonly angle: number;
  /** The time played that is shorter than a sub-step, carried to the next call. */
  readonly carry: number;
  /** The warm orb's angle over the last sub-steps, newest first: its trail (the cool orb's is opposite). */
  readonly trail: readonly number[];
}

/** What a step or a press did: START left the ready screen, or B left the game for the room. */
export type RunEvent = 'start' | 'leave';

export interface Stepped { run: Run; events: readonly RunEvent[] }

export function newRun({ seed }: { seed: number }): Run {
  return { phase: 'ready', seed, chapter: 0, lives: LIVES, score: 0, angle: 0, carry: 0, trail: [] };
}

// A sum of frames that lands on a whole sub-step is one: the float error of the carry never drops it.
const EPSILON = 1e-9;

/** Plays `dt` seconds (at most `RULES.maxDt`) with `held`: in play, whole sub-steps, the rest carried. On a ready screen nothing moves. */
export function step(run: Run, held: ReadonlySet<Action>, dt: number): Stepped {
  if (run.phase !== 'play') return { run, events: [] };
  let carry = run.carry + Math.min(Math.max(0, dt), RULES.maxDt);
  let { angle, trail } = run;
  while (carry >= RULES.subStep - EPSILON) {
    carry -= RULES.subStep;
    trail = [angle, ...trail].slice(0, RULES.trail);
    angle = turn(angle, held, RULES.subStep);
  }
  return { run: { ...run, angle, carry, trail }, events: [] };
}

/** Answers a press: START starts play from the ready screen, and B on the first ready screen leaves with no score. */
export function press(run: Run, action: Action): Stepped {
  if (run.phase === 'ready' && action === 'start') return { run: { ...run, phase: 'play', carry: 0 }, events: ['start'] };
  if (run.phase === 'ready' && action === 'b') return { run, events: ['leave'] };
  return { run, events: [] };
}
