// OMNI DUET inside the arcade shell (PRD 1633): the game as the arcade holds it while its scene is up.
// A hook of ArcadeApp: the import when the cabinet opens (and again on A after a failure), the run
// stepped by the canvas loop with the buttons held, the presses, the pause from outside, and the text
// layer, set only when it changes. The import itself is handed in by ArcadeApp, so the only way to the
// game's code stays its dynamic `import('./duet/index')` there (duet/guard.test.ts). The run tells the
// move into its game over once, whichever way it ended: then `over` hands the score reached to the
// arcade, which sends it once; A playing again is `again`.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action } from '../keys';
import type { Grid } from '../grid';
import type { SceneName } from './common.ts';
import { duetPress, loadDuet, sameDuetHud, type ArcadeDuet, type DuetGame, type DuetModule } from './duet.ts';

type Load = () => Promise<Pick<DuetModule, 'createDuet'>>;

/** What the arcade does when the run ends (it sends the score reached, once) and when A plays again. */
export interface DuetHooks { over(score: number): void; again(): void }

const NO_HOOKS: DuetHooks = { over: () => {}, again: () => {} };

/** The loaded game OMNI DUET draws with, while its scene shows. */
export const duetDrawOf = (scene: SceneName, duet: ArcadeDuet | null): DuetGame | null => (scene === 'duet' ? duet?.game ?? null : null);

/** The duet state once its game has loaded, or failed to. */
export function loadedDuet(d: ArcadeDuet | null, game: DuetGame | null): ArcadeDuet | null {
  if (!d) return d;
  return { ...d, status: game ? 'ready' : 'failed', game, hud: game ? game.hud() : null };
}

/** The state with the game's text layer as it stands now: the same state when nothing it says changed. */
function withHud(d: ArcadeDuet, game: DuetGame): ArcadeDuet {
  const hud = game.hud();
  return sameDuetHud(d.hud, hud) ? d : { ...d, hud };
}

/**
 * What a press does on the duet scene, given the state the arcade holds: `back` to the room (with the
 * state cleared), or the next state (A retries a failed import; the rest go to the loaded game, which
 * may end the run, `on.over` with its score, or begin again, `on.again`).
 */
export function pressedDuet(d: ArcadeDuet | null, action: Action, on: DuetHooks = NO_HOOKS): 'back' | ArcadeDuet | null {
  if (!d) return action === 'b' ? 'back' : null;
  const pressed = duetPress(d.status, action);
  if (pressed === 'back') return 'back';
  if (pressed === 'retry') return { ...d, status: 'loading', retry: d.retry + 1 };
  if (d.status !== 'ready' || !d.game) return d;
  const answer = d.game.press(action);
  if (answer.leave) return 'back';
  if (answer.over) on.over(d.game.hud().score);
  if (answer.again) on.again();
  return withHud(d, d.game);
}

/** The canvas loop's step on the game: the run plays `dt` with the buttons held, and a run that ended in it hands its score to `on.over`. */
export function steppedDuet(d: ArcadeDuet, game: DuetGame, held: ReadonlySet<Action>, dt: number, on: DuetHooks = NO_HOOKS): ArcadeDuet {
  if (game.step(held, dt).over) on.over(game.hud().score);
  return withHud(d, game);
}

/** The state after a pause from outside (a blurred window, a hidden tab, the scene left): the game paused, if it has loaded. */
export function pausedDuet(d: ArcadeDuet | null): ArcadeDuet | null {
  if (!d?.game) return d;
  d.game.pause();
  return withHud(d, d.game);
}

export function useDuet(load: Load, hooks: DuetHooks = NO_HOOKS) {
  const [duet, setDuet] = useState<ArcadeDuet | null>(null);
  const duetRef = useRef(duet);
  duetRef.current = duet;
  const loadRef = useRef(load);
  loadRef.current = load;
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
  // The game's code is imported once its cabinet opens, and again on each retry.
  const tries = duet?.status === 'loading' ? duet.retry : -1;
  useEffect(() => {
    if (tries < 0) return undefined;
    let gone = false;
    void loadDuet(loadRef.current, Math.floor(Math.random() * 2 ** 31)).then((game) => {
      if (!gone) setDuet((d) => loadedDuet(d, game));
    });
    return () => { gone = true; };
  }, [tries]);
  /** Sets the state at once, so the next press or frame reads it before React renders. */
  const show = useCallback((next: ArcadeDuet | null) => { duetRef.current = next; setDuet(next); }, []);
  /** A on the unlocked cabinet: the import starts, on the grid the cabinet is shown on. */
  const openDuet = useCallback((grid: Grid) => { setDuet({ status: 'loading', retry: 0, grid, game: null, hud: null }); }, []);
  const closeDuet = useCallback(() => { setDuet(null); }, []);
  /** A press on the scene: true when it leaves for the room (the state is cleared then). */
  const pressDuet = useCallback((action: Action): boolean => {
    const next = pressedDuet(duetRef.current, action, hooksRef.current);
    if (next === 'back') { show(null); return true; }
    if (next && next !== duetRef.current) show(next);
    return false;
  }, [show]);
  /** The canvas loop's step: the run plays the time since the last frame with the buttons held now, and the text layer follows it. */
  const stepDuet = useCallback((scene: SceneName, buttons: ReadonlySet<Action>, dt: number) => {
    const d = duetRef.current;
    const game = duetDrawOf(scene, d);
    if (!d || !game) return;
    const next = steppedDuet(d, game, buttons, dt, hooksRef.current);
    if (next !== d) show(next);
  }, [show]);
  /** A pause from outside, while the duet scene is up. */
  const pauseDuet = useCallback(() => {
    const d = duetRef.current;
    const next = pausedDuet(d);
    if (next !== d) show(next);
  }, [show]);
  return { duet, duetRef, openDuet, closeDuet, pressDuet, stepDuet, pauseDuet };
}
