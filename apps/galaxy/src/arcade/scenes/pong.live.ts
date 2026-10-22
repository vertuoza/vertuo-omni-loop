// PULSAR VOLLEY inside the arcade shell (PRD 2101): the game as the arcade holds it while its scene is up.
// A hook of ArcadeApp: the import when the cabinet opens (and again on A after a failure), the game
// stepped by the canvas loop, the presses, the pause from outside, the microphone stopped when the
// scene closes, and the text layer, set only when it changes. The import itself is handed in by
// ArcadeApp, so the only way to the game's code stays its dynamic `import('./pong/index')` there
// (pong/guard.test.ts). The match tells its move into `over` once, whichever way it ended: then
// `over` hands the score reached to the arcade, which sends it once; A playing again is `again`.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action } from '../keys';
import type { Grid } from '../grid';
import type { SceneName } from './common.ts';
import { loadPong, pongPress, samePongHud, type ArcadePong, type PongGame, type PongModule } from './pong.ts';

type Load = () => Promise<Pick<PongModule, 'createPong' | 'browserMic'>>;

/** What the arcade does when the match ends (it sends the score reached, once) and when A plays again. */
export interface PongHooks { over(score: number): void; again(): void }

const NO_HOOKS: PongHooks = { over: () => {}, again: () => {} };

/** The loaded game PULSAR VOLLEY draws with, while its scene shows. */
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
 * microphone stopped), or the next state (A retries a failed import; the rest go to the loaded game,
 * which may end the match, `on.over` with its score, or begin again, `on.again`).
 */
export function pressedPong(p: ArcadePong | null, action: Action, on: PongHooks = NO_HOOKS): 'back' | ArcadePong | null {
  if (!p) return action === 'b' ? 'back' : null;
  const pressed = pongPress(p.status, action);
  if (pressed === 'back') return 'back';
  if (pressed === 'retry') return { ...p, status: 'loading', retry: p.retry + 1 };
  if (p.status !== 'ready' || !p.game) return p;
  const answer = p.game.press(action);
  if (answer.leave) { p.game.close(); return 'back'; }
  if (answer.over) on.over(p.game.hud().score);
  if (answer.again) on.again();
  return withPongHud(p, p.game);
}

/** The canvas loop's step on the game: it plays `dt`, and a match that ended in it hands its score to `on.over`. */
export function steppedPong(p: ArcadePong, game: PongGame, dt: number, on: PongHooks = NO_HOOKS): ArcadePong {
  if (game.step(dt).over) on.over(game.hud().score);
  return withPongHud(p, game);
}

/** The state after a pause from outside (a blurred window, a hidden tab): the game paused, its microphone stopped. */
export function pausedPong(p: ArcadePong | null): ArcadePong | null {
  if (!p?.game) return p;
  p.game.pause();
  return withPongHud(p, p.game);
}

export function usePong(load: Load, hooks: PongHooks = NO_HOOKS) {
  const [pong, setPong] = useState<ArcadePong | null>(null);
  const pongRef = useRef(pong);
  pongRef.current = pong;
  const loadRef = useRef(load);
  loadRef.current = load;
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
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
    const next = pressedPong(pongRef.current, action, hooksRef.current);
    if (next === 'back') { show(null); return true; }
    if (next && next !== pongRef.current) show(next);
    return false;
  }, [show]);
  /** The canvas loop's step: the game reads the microphone and plays the match, and the text layer follows it. */
  const stepPong = useCallback((scene: SceneName, dt: number) => {
    const p = pongRef.current;
    const game = pongDrawOf(scene, p);
    if (!p || !game) return;
    const next = steppedPong(p, game, dt, hooksRef.current);
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
