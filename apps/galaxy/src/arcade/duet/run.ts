// OMNI DUET's run (PRD 1633): a pure simulation, no DOM, no canvas and no clock of its own. `step`
// plays the time since the last frame in fixed 1/60 s sub-steps, carrying the remainder to the next
// call, so the same inputs give the same run at 60 or at 120 frames a second; `press` answers a
// button, and `pause` a pause from outside. Each returns a new run and what happened.
//
// The run is a phase machine: `ready` waits for START; in `play` the chapter's waves fall one after
// another, each obstacle adding 1 once it is entirely below the circle (PRD 2318); a hit costs a life,
// restarts the chapter from its first wave with the score it began with, and goes back to `ready`;
// passing a chapter's last wave shows the next chapter's banner (`chapter`) for 2 seconds, during
// which nothing falls. After chapter IV the banner says ENDLESS · ×2 and endless mode begins: waves
// drawn from one seed, each obstacle adding 2, where a hit begins the wave hit again with the score it
// began with. START pauses (`paused`), and so does a
// blurred window, a hidden tab or the scene left; only START resumes. The run ends (`over`) at the
// last life lost, on SELECT on the pause screen, or on B on a ready screen once play has started:
// the move into `over` is told once, by the event `over`, so the score reached is sent once.
import type { Action } from '../keys';
import { RULES, turn } from './rules';
import { blocksAt, CHAPTERS, clearedAt, endlessWave, struck, type Wave } from './waves';

/** The chapters' titles, in the order they are played: each one's numeral and name, as the screens say them. */
export const CHAPTER_TITLES: readonly { numeral: string; name: string }[] = Object.freeze(CHAPTERS.map(({ numeral, name }) => ({ numeral, name })));

/** The lives a run starts with. */
const LIVES = 3;

/** How long the contact that cost a life stays on the screen, under a fading flash, before the ready screen clears. */
export const CRASH_SECONDS = 0.5;

/** The contact that cost a life, as it stood: the wave, the sub-step and the pair's angle, and the seconds it still shows. */
export interface Crash {
  readonly chapter: number;
  readonly endless: boolean;
  readonly wave: number;
  readonly tick: number;
  readonly angle: number;
  readonly left: number;
}

/** What an obstacle passed in a chapter adds to the score: a gate is one obstacle. */
export const OBSTACLE_POINTS = 1;

/** What an obstacle passed in endless mode adds to the score: twice a chapter's. */
export const ENDLESS_POINTS = 2;

/** How long a chapter's banner shows, in seconds, before its first wave falls. */
export const BANNER_SECONDS = 2;

const BANNER_STEPS = Math.round(BANNER_SECONDS / RULES.subStep);

/** Where the run stands: on a ready screen, in play, on a chapter's banner, paused, or over. */
export type Phase = 'ready' | 'play' | 'chapter' | 'paused' | 'over';

export interface Run {
  readonly phase: Phase;
  /** The run's seed: the same seed and inputs give the same run. */
  readonly seed: number;
  /** The chapter being played, an index into `CHAPTER_TITLES`: the last one, once in endless mode. */
  readonly chapter: number;
  /** Whether the run is in endless mode, past chapter IV. */
  readonly endless: boolean;
  /** The wave falling now: an index into the chapter's waves, or the endless wave's number from 0. */
  readonly wave: number;
  /** The sub-steps since the wave began to enter. */
  readonly tick: number;
  /** The sub-steps of the chapter's banner still to show. */
  readonly banner: number;
  readonly lives: number;
  readonly score: number;
  /** The score when the chapter began: what a hit in a chapter sets it back to. */
  readonly chapterScore: number;
  /** The score when the wave falling now began: what a hit in endless mode sets it back to. */
  readonly waveScore: number;
  /** The obstacles of the wave falling now that have scored. */
  readonly cleared: number;
  /** The waves passed in the whole run. */
  readonly passed: number;
  /** Whether play has started: B on a ready screen then ends the game rather than leaving it. */
  readonly started: boolean;
  /** The phase a pause goes back to: play, or a chapter's banner. */
  readonly resume: 'play' | 'chapter';
  /** The pair's angle, in radians, anticlockwise from the centre's right: the warm orb's; the cool one is opposite. */
  readonly angle: number;
  /** The time played that is shorter than a sub-step, carried to the next call. */
  readonly carry: number;
  /** The warm orb's angle over the last sub-steps, newest first: its trail (the cool orb's is opposite). */
  readonly trail: readonly number[];
  /** The contact that cost the last life lost, while it still shows; null otherwise. */
  readonly crash: Crash | null;
}

/**
 * What a step or a press did: START left a ready screen, B left the game for the room, a wave was
 * passed, a block hit an orb, a chapter's banner came up, endless mode began, the run was paused or
 * resumed, the run ended (once, whichever way), or A began again.
 */
export type RunEvent = 'start' | 'leave' | 'pass' | 'hit' | 'chapter' | 'endless' | 'pause' | 'resume' | 'over' | 'again';

export interface Stepped { run: Run; events: readonly RunEvent[] }

export function newRun({ seed }: { seed: number }): Run {
  return {
    phase: 'ready', seed, chapter: 0, endless: false, wave: 0, tick: 0, banner: 0, lives: LIVES, score: 0, chapterScore: 0, waveScore: 0,
    cleared: 0, passed: 0, started: false, resume: 'play', angle: 0, carry: 0, trail: [], crash: null,
  };
}

/** The wave falling now: the chapter's, or endless mode's. */
export function waveOf(run: Run): Wave | undefined {
  return run.endless ? endlessWave(run.wave) : CHAPTERS[run.chapter]?.waves[run.wave];
}

/** How many waves the run's chapter has: none counted in endless mode, which never ends. */
export const wavesIn = (run: Run): number => (run.endless ? 0 : CHAPTERS[run.chapter]?.waves.length ?? 0);

/** The wave a crash happened in. */
export function crashWave(crash: Crash): Wave | undefined {
  return crash.endless ? endlessWave(crash.wave) : CHAPTERS[crash.chapter]?.waves[crash.wave];
}

/**
 * The run after a hit: a life gone and, on a ready screen, the chapter from its first wave with the
 * score it began with, or in endless mode the wave hit with the score it began with; or over.
 */
function hit(run: Run): Stepped {
  const lives = run.lives - 1;
  const crash: Crash = { chapter: run.chapter, endless: run.endless, wave: run.wave, tick: run.tick, angle: run.angle, left: CRASH_SECONDS };
  const back = run.endless
    ? { ...run, lives, score: run.waveScore, tick: 0, cleared: 0, carry: 0, trail: [], crash }
    : { ...run, lives, score: run.chapterScore, waveScore: run.chapterScore, wave: 0, tick: 0, cleared: 0, carry: 0, trail: [], crash };
  if (lives <= 0) return { run: { ...back, lives: 0, phase: 'over' }, events: ['hit', 'over'] };
  return { run: { ...back, phase: 'ready' }, events: ['hit'] };
}

/** The run with the obstacles of its wave now below the circle scored: 1 each (2 in endless mode), each once. */
function scored(run: Run, cleared: number): Run {
  const fresh = Math.max(0, cleared - run.cleared);
  if (fresh === 0) return run;
  return { ...run, score: run.score + fresh * (run.endless ? ENDLESS_POINTS : OBSTACLE_POINTS), cleared: run.cleared + fresh };
}

/** The run after its wave was passed, its obstacles already scored: the next wave, or a banner. */
function passed(run: Run): Stepped {
  const { score } = run;
  const done = { ...run, waveScore: score, cleared: 0, passed: run.passed + 1, tick: 0 };
  if (run.endless || run.wave + 1 < wavesIn(run)) return { run: { ...done, wave: run.wave + 1 }, events: ['pass'] };
  const banner = { ...done, phase: 'chapter' as const, wave: 0, banner: BANNER_STEPS, chapterScore: score };
  if (run.chapter + 1 < CHAPTERS.length) return { run: { ...banner, chapter: run.chapter + 1 }, events: ['pass', 'chapter'] };
  return { run: { ...banner, endless: true }, events: ['pass', 'endless'] };
}

// A sum of frames that lands on a whole sub-step is one: the float error of the carry never drops it.
const EPSILON = 1e-9;

/** One sub-step: the orbs turn, the wave falls one step, then a hit, or the obstacles passed and the wave's pass, are counted. */
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
  const cleared = clearedAt(wave, tick);
  const next = scored({ ...moved, tick }, cleared);
  return cleared === wave.pieces.length ? passed(next) : { run: next, events: [] };
}

/** Plays `dt` seconds (at most `RULES.maxDt`) with `held`: in play and on a banner, whole sub-steps, the rest carried. Otherwise nothing moves. */
export function step(run: Run, held: ReadonlySet<Action>, dt: number): Stepped {
  if (run.phase !== 'play' && run.phase !== 'chapter') return { run: faded(run, dt), events: [] };
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

/** The run with its crash shown `dt` seconds longer (at most `RULES.maxDt`), gone once its time is up; the same run when none shows. */
function faded(run: Run, dt: number): Run {
  if (!run.crash) return run;
  const left = run.crash.left - Math.min(Math.max(0, dt), RULES.maxDt);
  return { ...run, crash: left > 0 ? { ...run.crash, left } : null };
}

/** The run paused, from play or a banner; anything else has nothing to pause. */
export function pause(run: Run): Stepped {
  if (run.phase !== 'play' && run.phase !== 'chapter') return { run, events: [] };
  return { run: { ...run, phase: 'paused', resume: run.phase, carry: 0 }, events: ['pause'] };
}

/** The run ended where it stands, the score reached kept: the one move into `over` a press makes. */
const ended = (run: Run): Stepped => ({ run: { ...run, phase: 'over', carry: 0 }, events: ['over'] });

/** What each phase does with a press: a move, or undefined when the press does nothing there. */
const PRESSES: Readonly<Record<Phase, (run: Run, action: Action) => Stepped | undefined>> = {
  ready: (run, action) => {
    if (action === 'start') return { run: { ...run, phase: 'play', started: true, carry: 0, crash: null }, events: ['start'] };
    if (action === 'b') return run.started ? ended(run) : { run, events: ['leave'] };
    return undefined;
  },
  play: (run, action) => (action === 'start' ? pause(run) : undefined),
  chapter: (run, action) => (action === 'start' ? pause(run) : undefined),
  paused: (run, action) => {
    if (action === 'start') return { run: { ...run, phase: run.resume, carry: 0 }, events: ['resume'] };
    return action === 'select' ? ended(run) : undefined;
  },
  over: (run, action) => {
    if (action === 'a') return { run: newRun({ seed: run.seed }), events: ['again'] };
    return action === 'b' ? { run, events: ['leave'] } : undefined;
  },
};

/**
 * Answers a press: START starts play from a ready screen, pauses play and resumes a pause; SELECT on
 * the pause ends the run; B on the first ready screen leaves, and on a later one ends the run; once
 * over, A plays again from chapter I and B leaves.
 */
export function press(run: Run, action: Action): Stepped {
  return PRESSES[run.phase](run, action) ?? { run, events: [] };
}
