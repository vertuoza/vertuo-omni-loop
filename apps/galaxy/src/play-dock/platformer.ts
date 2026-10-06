// SUPER OMNI WORLD in the play dock (PRD 817), as pure steps: the arcade's own session around the
// Phaser scene (arcade/platformer/session.ts), under the dock's rules. A question pauses the game at
// once, and while it is open every press but B waits; once it is gone, only START resumes the game.
// Leaving the game goes back: to the picker on B, and the dock folds on SELECT.
import type { Action } from '../arcade/keys';
import type { ScreenStatus } from '../arcade/platformer/PlatformerScreen';
import { newSession, pauseSession, pressSession, type Session } from '../arcade/platformer/session';

/** The game as the dock holds it: the arcade's session, where Phaser's import stands, and the retries asked. */
export interface DockPf { session: Session; status: ScreenStatus; retry: number }

export const newDockPf = (): DockPf => ({ session: newSession(), status: 'loading', retry: 0 });

/** A question arrived, or the tab or the window was left: a game in play pauses. */
export const askPf = (p: DockPf): DockPf => {
  const session = pauseSession(p.session);
  return session === p.session ? p : { ...p, session };
};

/** Whether the scene stands still: a question is open, or the session is on a screen over the stage. */
export const pfPaused = (p: DockPf, asking: boolean): boolean => asking || p.session.phase !== 'play';

/** A press: the game after it, and whether it leaves, back to the picker (`back`) or folding the dock (`fold`). */
export function pressPf(p: DockPf, action: Action, asking: boolean): { pf: DockPf; out?: 'back' | 'fold' } {
  if (asking && action !== 'b') return { pf: p }; // the question comes first: ANSWER, or go back
  const r = pressSession(p.session, action, p.status);
  if (r.leave) return { pf: p, out: action === 'select' ? 'fold' : 'back' };
  if (r.retry) return { pf: { ...p, retry: p.retry + 1 } };
  return r.session === p.session ? { pf: p } : { pf: { ...p, session: r.session } };
}
