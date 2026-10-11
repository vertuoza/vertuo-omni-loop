// OMNI DUET's run (PRD 1633): a pure simulation, no DOM, no canvas and no clock of its own. `step`
// plays the time since the last frame in fixed 1/60 s sub-steps, carrying the remainder to the next
// call, so the same inputs give the same run at 60 or at 120 frames a second; `press` answers a
// button. Both return a new run and what happened.
//
// The run is a phase machine: `ready` waits for START; in `play` the chapter's waves fall one after
// another, each passed adding 10; a hit costs a life, restarts the chapter from its first wave with
// the score it began with, and goes back to `ready`; passing a chapter's last wave shows the next
// chapter's banner (`chapter`) for 2 seconds, during which nothing falls; the last life lost ends the
// run (`over`). Endless mode after chapter IV, the pause and the score's send come with slice 4.
import type { Action } from '../keys';
import { RULES, turn } from './rules';
import { blocksAt, CHAPTERS as WRITTEN, passedAt, struck, type Wave } from './waves';

/** The chapters, in the order they are played: each one's numeral and name, as the screens say them. */
export const CHAPTERS: readonly { numeral: string; name: string }[] = Object.freeze(WRITTEN.map(({ numeral, name }) => ({ numeral, name })));

/** The lives a run starts with. */
export const LIVES = 3;

/** What a wave passed in a chapter adds to the score. */
export const WAVE_POINTS = 10;

/** How long a chapter's banner shows, in seconds, before its first wave falls. */
export const BANNER_SECONDS = 2;

const BANNER_STEPS = Math.round(BANNER_SECONDS / RULES.subStep);

/** Where the run stands: on a ready screen, in play, on a chapter's banner, or over. */
export type Phase = 'ready' | 'play' | 'chapter' | 'over';

export interface Run {
  readonly phase: Phase;
  /** The run's seed: the same seed and inputs give the same run. */
  readonly seed: number;
  /** The chapter being played, an index into `CHAPTERS`. */
  readonly chapter: number;
  /** The wave falling now, an index into the chapter's waves: its length once the last chapter's last wave is passed. */
  readonly wave: number;
  /** The sub-steps since the wave began to enter. */
  readonly tick: number;
  /** The sub-steps of the chapter's banner still to show. */
  readonly banner: number;
  readonly lives: number;
  readonly score: number;
  /** The score when the chapter began: what a hit sets it back to. */
  readonly chapterScore: number;
  /** The waves passed in the whole run. */
  readonly passed: number;
  /** The pair's angle, in radians, anticlockwise from the crest's right: the warm orb's; the cool one is opposite. */
  readonly angle: number;
  /** The time played that is shorter than a sub-step, carried to the next call. */
  readonly carry: number;
  /** The warm orb's angle over the last sub-steps, newest first: its trail (the cool orb's is opposite). */
  readonly trail: readonly number[];
}

/**
 * What a step or a press did: START left a ready screen, B left the game for the room, a wave was
 * passed, a block hit an orb, a chapter's banner came up, the last life was lost, or A began again.
 */
export type RunEvent = 'start' | 'leave' | 'pass' | 'hit' | 'chapter' | 'over' | 'again';

export interface Stepped { run: Run; events: readonly RunEvent[] }

export function newRun({ seed }: { seed: number }): Run {
  return {
    phase: 'ready', seed, chapter: 0, wave: 0, tick: 0, banner: 0, lives: LIVES, score: 0, chapterScore: 0, passed: 0,
    angle: 0, carry: 0, trail: [],
  };
}

/** The wave falling now, or none once the last chapter's last wave is passed. */
export function waveOf(run: Run): Wave | undefined {
  return WRITTEN[run.chapter]?.waves[run.wave];
}

/** How many waves the run's chapter has. */
export const wavesIn = (run: Run): number => WRITTEN[run.chapter]?.waves.length ?? 0;

/** The run after a hit: a life gone, the chapter from its first wave with the score it began with, on a ready screen; or over. */
function hit(run: Run): Stepped {
  const lives = run.lives - 1;
  const back = { ...run, lives, score: run.chapterScore, wave: 0, tick: 0, carry: 0, trail: [] };
  if (lives <= 0) return { run: { ...back, lives: 0, phase: 'over' }, events: ['hit', 'over'] };
  return { run: { ...back, phase: 'ready' }, events: ['hit'] };
}

/** The run after its wave was passed: 10 more, then the next wave, or the next chapter's banner. */
function passed(run: Run): Stepped {
  const score = run.score + WAVE_POINTS;
  const done = { ...run, score, passed: run.passed + 1, tick: 0 };
  if (run.wave + 1 < wavesIn(run)) return { run: { ...done, wave: run.wave + 1 }, events: ['pass'] };
  if (run.chapter + 1 < WRITTEN.length) {
    return { run: { ...done, phase: 'chapter', chapter: run.chapter + 1, wave: 0, banner: BANNER_STEPS, chapterScore: score }, events: ['pass', 'chapter'] };
  }
  return { run: { ...done, wave: wavesIn(run) }, events: ['pass'] };
}

// A sum of frames that lands on a whole sub-step is one: the float error of the carry never drops it.
const EPSILON = 1e-9;

/** One sub-step: the orbs turn, the wave falls one step, then a hit or a pass is counted. */
function sub(run: Run, held: ReadonlySet<Action>): Stepped {
  const angle = turn(run.angle, held, RULES.subStep);
  const trail = [run.angle, ...run.trail].slice(0, RULES.trail);
  const moved = { ...run, angle, trail };
  if (run.phase === 'chapter') {
    const banner = run.banner - 1;
    return { run: { ...moved, banner, phase: banner > 0 ? 'chapter' : 'play' }, events: [] };
  }
  const wave = waveOf(run);
  if (!wave) return { run: moved, events: [] };
  const tick = run.tick + 1;
  if (struck(angle, blocksAt(wave, tick))) return hit({ ...moved, tick });
  if (passedAt(wave, tick)) return passed({ ...moved, tick });
  return { run: { ...moved, tick }, events: [] };
}

/** Plays `dt` seconds (at most `RULES.maxDt`) with `held`: in play and on a banner, whole sub-steps, the rest carried. On a ready screen or once over, nothing moves. */
export function step(run: Run, held: ReadonlySet<Action>, dt: number): Stepped {
  if (run.phase !== 'play' && run.phase !== 'chapter') return { run, events: [] };
  let carry = run.carry + Math.min(Math.max(0, dt), RULES.maxDt);
  let r = run;
  const events: RunEvent[] = [];
  while (carry >= RULES.subStep - EPSILON) {
    carry -= RULES.subStep;
    const s = sub(r, held);
    r = s.run;
    events.push(...s.events);
    if (r.phase !== 'play' && r.phase !== 'chapter') return { run: { ...r, carry: 0 }, events };
  }
  return { run: { ...r, carry }, events };
}

/**
 * Answers a press: START starts play from a ready screen, B on a ready screen leaves; once over, A
 * plays again from chapter I and B leaves.
 */
export function press(run: Run, action: Action): Stepped {
  if (run.phase === 'ready' && action === 'start') return { run: { ...run, phase: 'play', carry: 0 }, events: ['start'] };
  if (run.phase === 'ready' && action === 'b') return { run, events: ['leave'] };
  if (run.phase === 'over' && action === 'a') return { run: newRun({ seed: run.seed }), events: ['again'] };
  if (run.phase === 'over' && action === 'b') return { run, events: ['leave'] };
  return { run, events: [] };
}
