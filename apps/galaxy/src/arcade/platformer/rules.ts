// Super Omni World's rules, without Phaser (PRD 817): the physics numbers the scene plays by, in one
// block so a follow-up can tune the feel without touching the scene, and the jump that grows with
// how long A is held. Phaser does the gravity, the collisions and the drawing; each frame the scene
// asks these rules how fast the hero runs and whether the jump still lifts.
import type { Action } from '../keys';
import { positionOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

/**
 * What the scene reports to the rules: the only things that happen in the game. `second` is the
 * stage's clock: one second of play gone by.
 */
export type PlatformerEvent = 'coin' | 'stomp' | 'hurt' | 'pit' | 'flag' | 'second';

/** What an event is worth: a coin, a stomp, and each second left on the clock at the flag. */
export const SCORE = Object.freeze({ coin: 10, stomp: 50, perSecond: 10 });
/** The lives a game starts with. */
export const LIVES = 3;
/** Each stage's clock, in seconds. */
export const STAGE_SECONDS = 300;

/** The events that cost a life, and so restart the stage. The clock running out costs one too. */
export const LIFE_EVENTS: ReadonlySet<PlatformerEvent> = new Set<PlatformerEvent>(['hurt', 'pit']);

/** A game as the rules keep it: the stage played, the score, the coins, the lives, the clock. */
export interface Run {
  stage: string;
  score: number;
  coins: number;
  lives: number;
  /** Seconds left on the stage's clock. */
  time: number;
}

/** The world's stages, in the order they are played: its last flag clears the world. */
export const WORLD = Object.freeze(['1-1', '1-2', '1-3'] as const);

/** The stage played after `stage`; none after the last. */
export function nextStage(stage: string): string | null {
  const i = positionOf(WORLD, stage);
  return i >= 0 && i < WORLD.length - 1 ? WORLD[i + 1]! : null;
}

/**
 * What an event leads to: play goes on, a life is lost and the stage starts again, the game is
 * over, the stage is cleared, or the last stage is cleared and with it the world.
 */
export type Outcome = 'play' | 'life' | 'over' | 'clear' | 'world';

export const newRun = (): Run => ({ stage: WORLD[0], score: 0, coins: 0, lives: LIVES, time: STAGE_SECONDS });

/** The run on the next stage, once its flag is cleared: the score, the coins and the lives kept, a full clock. */
export function nextRun(run: Run): Run {
  const stage = nextStage(run.stage);
  return stage ? { ...run, stage, time: STAGE_SECONDS } : run;
}

const loseLife = (run: Run): { run: Run; outcome: Outcome } => {
  const lives = run.lives - 1;
  return { run: { ...run, lives, time: STAGE_SECONDS }, outcome: lives > 0 ? 'life' : 'over' };
};

/** One event, heard by the rules: the run after it, and what it leads to. */
export function hearRun(run: Run, e: PlatformerEvent): { run: Run; outcome: Outcome } {
  switch (e) {
    case 'coin': return { run: { ...run, score: run.score + SCORE.coin, coins: run.coins + 1 }, outcome: 'play' };
    case 'stomp': return { run: { ...run, score: run.score + SCORE.stomp }, outcome: 'play' };
    case 'hurt':
    case 'pit': return loseLife(run);
    case 'second': return run.time > 1 ? { run: { ...run, time: run.time - 1 }, outcome: 'play' } : loseLife(run);
    case 'flag': return { run: { ...run, score: run.score + SCORE.perSecond * run.time }, outcome: nextStage(run.stage) ? 'clear' : 'world' };
  }
}

/** A tile's side, in game pixels: the stages are laid out on this grid. */
export const TILE = 16;

/** The feel, chosen by eye: pixels and seconds. */
export const PHYSICS = Object.freeze({
  /** Pulls the hero down whenever the jump no longer lifts, px/s². */
  gravity: 1400,
  /** The fastest the hero falls, px/s. */
  maxFall: 520,
  /** ◀ or ▶ alone, px/s. */
  walk: 110,
  /** ◀ or ▶ with B held, px/s. */
  run: 180,
  /** The hero's body in the physics: narrower than the 32×48 sprite, which has air around it. */
  heroW: 18,
  heroH: 44,
  /** How fast a stomp sends the hero back up, px/s. */
  bounce: 260,
  /** An Entropy blob's walk, px/s. */
  enemy: 36,
  /** The blob's body in the physics: narrower and lower than its 24×24 sprite, spikes left out. */
  enemyW: 18,
  enemyH: 16,
});

/**
 * The jump: it leaves the ground at `speed`, and keeps that speed while A stays held, up to
 * `holdMax` seconds; then gravity takes over. A tap jumps low, a held A jumps high.
 */
export const JUMP = Object.freeze({ speed: 330, holdMax: 0.14 });

/** Where a jump stands: A as it was last frame (a jump takes a fresh press), and the hold. */
export interface JumpState {
  wasA: boolean;
  holding: boolean;
  /** How long A has been held into this jump, in seconds. */
  held: number;
}

export const JUMP_IDLE: JumpState = Object.freeze({ wasA: false, holding: false, held: 0 });

/**
 * One frame of the jump. `vy` is the vertical speed the scene must set (negative is up), or null
 * when the jump has nothing to say and gravity runs the fall. A jump starts only on the ground, on a
 * press of A that was not held the frame before; in mid-air A starts nothing.
 */
export function jumpStep(s: JumpState, input: { a: boolean; onGround: boolean }, dt: number): { state: JumpState; vy: number | null } {
  const { a, onGround } = input;
  if (a && !s.wasA && onGround) return { state: { wasA: true, holding: true, held: 0 }, vy: -JUMP.speed };
  if (s.holding && a && s.held + dt <= JUMP.holdMax) return { state: { wasA: a, holding: true, held: s.held + dt }, vy: -JUMP.speed };
  return { state: { wasA: a, holding: false, held: s.held }, vy: null };
}

/** The hero's speed along the ground from the buttons held: ◀ or ▶, faster with B; none with both or neither. */
export function heroSpeed(held: ReadonlySet<Action>): number {
  const dir = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  return dir * (held.has('b') ? PHYSICS.run : PHYSICS.walk);
}

const STEP = 1 / 240;

/**
 * A jump from flat ground with A held for `hold` seconds (a tap is held for a single frame), played
 * with the scene's own rules: how high it goes and how long it stays in the air, in px and seconds.
 */
export function simulateJump(hold: number): { height: number; airtime: number } {
  let s: JumpState = JUMP_IDLE, y = 0, vy = 0, t = 0, top = 0;
  const heldFor = Math.max(hold, STEP);
  do {
    const step = jumpStep(s, { a: t < heldFor, onGround: t === 0 }, STEP);
    s = step.state;
    vy = step.vy ?? Math.min(PHYSICS.maxFall, vy + PHYSICS.gravity * STEP);
    y += vy * STEP;
    t += STEP;
    top = Math.max(top, -y);
  } while (y < 0 && t < 10);
  return { height: top, airtime: t };
}

/**
 * The widest pit, in tiles, a stage may hold: what a full run-jump crosses, the hero's body
 * included, with a tile to spare. The stage checks refuse a wider one.
 */
export function longestPit(): number {
  const { airtime } = simulateJump(JUMP.holdMax);
  return Math.floor((PHYSICS.run * airtime - PHYSICS.heroW) / TILE) - 1;
}
