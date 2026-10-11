// OMNI DUET inside the arcade shell (PRD 1633): the game as the arcade holds it while its scene is up.
// A hook of ArcadeApp: the import when the cabinet opens (and again on A after a failure), the run
// stepped by the canvas loop with the buttons held, the presses, and the text layer, set only when it
// changes. The import itself is handed in by ArcadeApp, so the only way to the game's code stays its
// dynamic `import('./duet/index')` there (duet/guard.test.ts).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action } from '../keys';
import type { Grid } from '../grid';
import type { SceneName } from './common.ts';
import { duetPress, loadDuet, sameDuetHud, type ArcadeDuet, type DuetGame, type DuetModule } from './duet.ts';

type Load = () => Promise<Pick<DuetModule, 'createDuet'>>;

/** The loaded game OMNI DUET draws with, while its scene shows. */
export const duetDrawOf = (scene: SceneName, duet: ArcadeDuet | null): DuetGame | null => (scene === 'duet' ? duet?.game ?? null : null);

/** The duet state once its game has loaded, or failed to. */
export function loadedDuet(d: ArcadeDuet | null, game: DuetGame | null): ArcadeDuet | null {
  if (!d) return d;
  return { ...d, status: game ? 'ready' : 'failed', game, hud: game ? game.hud() : null };
}

/**
 * What a press does on the duet scene, given the state the arcade holds: `back` to the room (with the
 * state cleared), or the next state (A retries a failed import; the rest go to the loaded game).
 */
export function pressedDuet(d: ArcadeDuet | null, action: Action): 'back' | ArcadeDuet | null {
  if (!d) return action === 'b' ? 'back' : null;
  const pressed = duetPress(d.status, action, d.hud?.phase);
  if (pressed === 'back') return 'back';
  if (pressed === 'retry') return { ...d, status: 'loading', retry: d.retry + 1 };
  if (d.status !== 'ready' || !d.game) return d;
  if (d.game.press(action).leave) return 'back';
  const hud = d.game.hud();
  return sameDuetHud(d.hud, hud) ? d : { ...d, hud };
}

export function useDuet(load: Load) {
  const [duet, setDuet] = useState<ArcadeDuet | null>(null);
  const duetRef = useRef(duet);
  duetRef.current = duet;
  const loadRef = useRef(load);
  loadRef.current = load;
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
  /** A on the unlocked cabinet: the import starts, on the grid the cabinet is shown on. */
  const openDuet = useCallback((grid: Grid) => { setDuet({ status: 'loading', retry: 0, grid, game: null, hud: null }); }, []);
  const closeDuet = useCallback(() => { setDuet(null); }, []);
  /** A press on the scene: true when it leaves for the room (the state is cleared then). */
  const pressDuet = useCallback((action: Action): boolean => {
    const next = pressedDuet(duetRef.current, action);
    if (next === 'back') { setDuet(null); return true; }
    if (next && next !== duetRef.current) setDuet(next);
    return false;
  }, []);
  /** The canvas loop's step: the run plays the time since the last frame with the buttons held now, and the text layer follows it. */
  const stepDuet = useCallback((scene: SceneName, buttons: ReadonlySet<Action>, dt: number) => {
    const game = duetDrawOf(scene, duetRef.current);
    if (!game) return;
    game.step(buttons, dt);
    const hud = game.hud();
    setDuet((d) => (d && d.game === game && !sameDuetHud(d.hud, hud) ? { ...d, hud } : d));
  }, []);
  return { duet, duetRef, openDuet, closeDuet, pressDuet, stepDuet };
}
