// A game of Super Omni World as the arcade holds it around the Phaser scene (PRD 817): which stage,
// and which screen is up. The scene reads the held buttons itself; a press reaches this file only
// for what the scene does not read: START to pause, SELECT or B to leave the pause, a key on the
// stage clear, and A or B over the line that says Phaser did not load.
import type { Action } from '../keys';
import type { ScreenStatus } from './PlatformerScreen';
import type { PlatformerEvent } from './rules';

export type Phase = 'play' | 'paused' | 'clear';

export interface Session {
  /** The stage being played, as stages.ts names it. */
  stage: string;
  phase: Phase;
}

export const newSession = (): Session => ({ stage: '1-1', phase: 'play' });

/** What a press does: the session after it, and whether it leaves the game or retries the import. */
export function pressSession(s: Session, action: Action, status: ScreenStatus): { session: Session; leave?: true; retry?: true } {
  if (status === 'failed') {
    if (action === 'a') return { session: s, retry: true };
    if (action === 'b') return { session: s, leave: true };
    return { session: s };
  }
  if (status === 'loading') return action === 'b' ? { session: s, leave: true } : { session: s };
  switch (s.phase) {
    case 'play': return action === 'start' ? { session: { ...s, phase: 'paused' } } : { session: s };
    case 'paused':
      if (action === 'start') return { session: { ...s, phase: 'play' } };
      if (action === 'select' || action === 'b') return { session: s, leave: true };
      return { session: s };
    case 'clear': return action === 'a' || action === 'b' || action === 'start' ? { session: s, leave: true } : { session: s };
  }
}

/** What the scene's event changes: the flag clears the stage; the rest is play going on. */
export function hearEvent(s: Session, e: PlatformerEvent): Session {
  if (e === 'flag' && s.phase === 'play') return { ...s, phase: 'clear' };
  return s;
}

/** A pause from outside the game (a hidden tab, a lost focus, OPEN THE APP?): only a game in play pauses. */
export const pauseSession = (s: Session): Session => (s.phase === 'play' ? { ...s, phase: 'paused' } : s);
