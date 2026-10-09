// OMNI KART on the canvas (PRD 1359): the scene's group. The game's code lives in `arcade/kart/` and
// is imported only when its cabinet opens, so this file, like every other scene's, imports nothing from
// that folder at run time (guard.test.ts): the loaded game comes in as `FrameState.kart` and draws
// itself, and until then, or if it never loads, the canvas is the dark behind the text layer's line
// (kart.tsx). The grid the race is drawn on is the one it started on, as SUPER OMNI WORLD keeps its own.
import type { Action } from '../keys';
import type { Grid } from '../grid';
import type { FrameState, KartDraw, Pages, SceneName } from './common.ts';
import { space } from './common.ts';

/** The race is laid out on the tall grid too: the Game Boy held upright plays it on 320×288. */
export const TALL_SCENES: readonly SceneName[] = ['kart'];

export const PAGES: Pages = {};

/** What the text layer shows of the race: its phase, and the countdown's number or the GO that follows it. */
export interface KartHud { phase: 'ready' | 'countdown' | 'race' | 'paused'; beat: '3' | '2' | '1' | 'GO' | null }

/** The player left the race from its pause. */
export interface KartQuit { quit: boolean }

/**
 * The race itself, as the arcade drives it (PRD 1359, slice 2): stepped by the canvas loop with the
 * buttons held, answering presses, paused from outside, and read by the text layer through `hud()`.
 */
export interface KartGame extends KartDraw {
  step(held: ReadonlySet<Action>, dt: number): void;
  press(action: Action): KartQuit;
  pause(): void;
  hud(): KartHud;
}

/** Where the game's import stands: on its way, the game ready, or the import failed. */
export type KartStatus = 'loading' | 'ready' | 'failed';

/** What the arcade holds while the kart scene is up: where the import stands, the retries asked for, the grid it started on and the game once loaded. */
export interface ArcadeKart { status: KartStatus; retry: number; grid: Grid; game: KartGame | null; hud: KartHud | null }

/** The line over the screen when the import failed. */
export const NOT_LOADED = 'GAME DID NOT LOAD · A TO RETRY';

/** What the ready screen says: the circuit, its laps and what starts the race. Its laps are `LAPS` of kart/track.ts. */
export const READY_LINE = 'COMET RING · 3 LAPS · PRESS START';

/** The game, loaded: what `import('arcade/kart/index')` gives. */
export type KartModule = typeof import('../kart/index');

/**
 * Imports the game and makes it. A failed import (offline, or a chunk gone after a deploy) is logged
 * with `console.error` and answers null, so the screen can say so and A can try again.
 */
export async function loadKart(load: () => Promise<Pick<KartModule, 'createKart'>>, seed = 1359): Promise<KartGame | null> {
  try {
    return (await load()).createKart({ seed });
  } catch (err) {
    console.error(err);
    return null;
  }
}

/** What the screen before the race says it is: PAUSED, with its way on and its way out. */
export const PAUSED_LINE = 'PAUSED';

/**
 * What a press does on the screens before the race: A imports again after a failure, B goes back to
 * the room. Once the game has loaded and its race began (`phase` past `ready`), B is the race's own
 * and the room is left from the pause only: the rest of the buttons go to the race.
 */
export function kartPress(status: KartStatus, action: Action, phase: KartHud['phase'] = 'ready'): 'retry' | 'back' | null {
  if (action === 'b') return phase === 'ready' ? 'back' : null;
  return status === 'failed' && action === 'a' ? 'retry' : null;
}

/** Whether two text layers say the same: the arcade re-renders only when they differ. */
export const sameKartHud = (a: KartHud | null, b: KartHud | null): boolean => a === b || (!!a && !!b && a.phase === b.phase && a.beat === b.beat);

export function drawKart(ctx: CanvasRenderingContext2D, s: FrameState) {
  if (s.kart) { s.kart.draw(ctx, s); return; }
  space(ctx, s, 0.2); // loading, or failed: the Omni sky behind the line
}
