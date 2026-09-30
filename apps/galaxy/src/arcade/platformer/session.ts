// A game of Super Omni World as the arcade holds it around the Phaser scene (PRD 817): the run the
// rules keep (stage, score, coins, lives, clock) and which screen is up. The scene reads the held
// buttons itself; a press reaches this file only for what the scene does not read: START to start
// and pause, SELECT or B to leave the pause, A or START on a stage clear to go on to the next stage,
// a key on WORLD CLEAR or the game over, and A or B over the line that says Phaser did not load.
import type { Action } from '../keys';
import type { ScreenStatus } from './PlatformerScreen';
import { hearRun, newRun, nextRun, type PlatformerEvent, type Run } from './rules';

/**
 * The screen up: the stage waiting for START (at the start of a game, of each stage, and after each
 * life lost), play, the pause, a stage clear, WORLD CLEAR (1-3's flag) and the game over. The game
 * runs only in `play`.
 */
export type Phase = 'ready' | 'play' | 'paused' | 'clear' | 'world' | 'over';

export interface Session extends Run {
  phase: Phase;
}

export const newSession = (): Session => ({ ...newRun(), phase: 'ready' });

/** What a press does: the session after it, and whether it leaves the game or retries the import. */
export function pressSession(s: Session, action: Action, status: ScreenStatus): { session: Session; leave?: true; retry?: true } {
  if (status === 'failed') {
    if (action === 'a') return { session: s, retry: true };
    if (action === 'b') return { session: s, leave: true };
    return { session: s };
  }
  if (status === 'loading') return action === 'b' ? { session: s, leave: true } : { session: s };
  switch (s.phase) {
    case 'ready':
      if (action === 'start') return { session: { ...s, phase: 'play' } };
      return action === 'b' ? { session: s, leave: true } : { session: s };
    case 'play': return action === 'start' ? { session: { ...s, phase: 'paused' } } : { session: s };
    case 'paused':
      if (action === 'start') return { session: { ...s, phase: 'play' } };
      if (action === 'select' || action === 'b') return { session: s, leave: true };
      return { session: s };
    case 'clear': return action === 'a' || action === 'start' ? { session: { ...nextRun(s), phase: 'ready' } } : { session: s };
    case 'world':
    case 'over': return action === 'a' || action === 'b' || action === 'start' ? { session: s, leave: true } : { session: s };
  }
}

const PHASE_AFTER = { play: 'play', life: 'ready', over: 'over', clear: 'clear', world: 'world' } as const;

/**
 * What the scene's event changes, heard only in play: the rules score it, and a life lost puts the
 * stage (which the scene has started again) back on its ready screen.
 */
export function hearEvent(s: Session, e: PlatformerEvent): Session {
  if (s.phase !== 'play') return s;
  const { run, outcome } = hearRun(s, e);
  return { ...s, ...run, phase: PHASE_AFTER[outcome] };
}

/** A pause from outside the game (a hidden tab, a lost focus, OPEN THE APP?): only a game in play pauses. */
export const pauseSession = (s: Session): Session => (s.phase === 'play' ? { ...s, phase: 'paused' } : s);

/** A game at its end: the game over or WORLD CLEAR, where its score is sent. */
export const ended = (s: Session): boolean => s.phase === 'over' || s.phase === 'world';

/** The score to send when `next` has just ended the game `prev` was still playing; none otherwise, so a game sends once. */
export const scoreToSend = (prev: Session, next: Session): number | null => (ended(next) && !ended(prev) ? next.score : null);
