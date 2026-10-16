// OMNI PONG inside the arcade shell (PRD 2101): the game as the arcade holds it while its scene is up.
// A hook of ArcadeApp: the import when the cabinet opens (and again on A after a failure), the game
// stepped by the canvas loop, the presses, the pause from outside, the microphone stopped when the
// scene closes, and the text layer, set only when it changes. The import itself is handed in by
// ArcadeApp, so the only way to the game's code stays its dynamic `import('./pong/index')` there
// (pong/guard.test.ts).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action } from '../keys';
import type { Grid } from '../grid';
import type { SceneName } from './common.ts';
import { loadPong, pongPress, samePongHud, type ArcadePong, type PongGame, type PongModule } from './pong.ts';

type Load = () => Promise<Pick<PongModule, 'createPong' | 'browserMic'>>;

/** The loaded game OMNI PONG draws with, while its scene shows. */
export const pongDrawOf = (scene: SceneName, pong: ArcadePong | null): PongGame | null => (scene === 'pong' ? pong?.game ?? null : null);

/** The pong state once its game has loaded, or failed to. */
export function loadedPong(p: ArcadePong | null, game: PongGame | null): ArcadePong | null {
  if (!p) { game?.close(); return p; } // the scene closed while the game loaded
  return { ...p, status: game ? 'ready' : 'failed', game, hud: game ? game.hud() : null };
}

/** The state with the game's text layer as it stands now: the same state when nothing it says changed. */
export function withPongHud(p: ArcadePong, game: PongGame): ArcadePong {
  const hud = game.hud();
  return samePongHud(p.hud, hud) ? p : { ...p, hud };
}

/**
 * What a press does on the pong scene, given the state the arcade holds: `back` to the room (with the
 * microphone stopped), or the next state (A retries a failed import; the rest go to the loaded game).
 */
export function pressedPong(p: ArcadePong | null, action: Action): 'back' | ArcadePong | null {
  if (!p) return action === 'b' ? 'back' : null;
  const pressed = pongPress(p.status, action);
  if (pressed === 'back') return 'back';
  if (pressed === 'retry') return { ...p, status: 'loading', retry: p.retry + 1 };
  if (p.status !== 'ready' || !p.game) return p;
  if (p.game.press(action).leave) { p.game.close(); return 'back'; }
  return withPongHud(p, p.game);
}

/** The state after a pause from outside (a blurred window, a hidden tab): the game paused, its microphone stopped. */
export function pausedPong(p: ArcadePong | null): ArcadePong | null {
  if (!p?.game) return p;
  p.game.pause();
  return withPongHud(p, p.game);
}

export function usePong(load: Load) {
  const [pong, setPong] = useState<ArcadePong | null>(null);
  const pongRef = useRef(pong);
  pongRef.current = pong;
  const loadRef = useRef(load);
  loadRef.current = load;
  /** Sets the state at once, so the next press or frame reads it before React renders. */
  const show = useCallback((next: ArcadePong | null) => { pongRef.current = next; setPong(next); }, []);
  // The game's code is imported once its cabinet opens, and again on each retry.
  const tries = pong?.status === 'loading' ? pong.retry : -1;
  useEffect(() => {
    if (tries < 0) return undefined;
    let gone = false;
    void loadPong(loadRef.current).then((game) => {
      if (gone) { game?.close(); return; }
      show(loadedPong(pongRef.current, game));
    });
    return () => { gone = true; };
  }, [tries, show]);
  // Leaving the page stops the microphone too.
  useEffect(() => () => { pongRef.current?.game?.close(); }, []);
  /** A on the unlocked cabinet: the import starts, on the grid the cabinet is shown on. */
  const openPong = useCallback((grid: Grid) => { show({ status: 'loading', retry: 0, grid, game: null, hud: null }); }, [show]);
  /**
   * The scene shown now: the game is only ever on its own scene, so another scene closes it and stops
   * its microphone. False when the pong scene is up with no game, which then goes back to the room.
   */
  const followPong = useCallback((scene: SceneName): boolean => {
    if (scene === 'pong') return pongRef.current !== null;
    if (pongRef.current) { pongRef.current.game?.close(); show(null); }
    return true;
  }, [show]);
  /** A press on the scene: true when it leaves for the room (the state is cleared then). */
  const pressPong = useCallback((action: Action): boolean => {
    const next = pressedPong(pongRef.current, action);
    if (next === 'back') { show(null); return true; }
    if (next && next !== pongRef.current) show(next);
    return false;
  }, [show]);
  /** The canvas loop's step: the game reads the microphone, and the text layer follows it. */
  const stepPong = useCallback((scene: SceneName, dt: number) => {
    const p = pongRef.current;
    const game = pongDrawOf(scene, p);
    if (!p || !game) return;
    game.step(dt);
    const next = withPongHud(p, game);
    if (next !== p) show(next);
  }, [show]);
  /** A pause from outside, while the pong scene is up. */
  const pausePong = useCallback(() => {
    const p = pongRef.current;
    const next = pausedPong(p);
    if (next !== p) show(next);
  }, [show]);
  return { pong, pongRef, openPong, followPong, pressPong, stepPong, pausePong };
}
