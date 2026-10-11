// OMNI DUET on the canvas (PRD 1633): the scene's group. The game's code lives in `arcade/duet/` and is
// imported only when its cabinet opens, so this file, like every other scene's, imports nothing from
// that folder at run time (duet/guard.test.ts): the loaded game comes in as `FrameState.duet` and draws
// its playfield itself. The playfield is one 320×288 field on both grids: the whole tall grid, and
// centred on the wide grid, scaled to its height, with the Omni sky on its sides. Until the game has
// loaded, or if it never does, the canvas is the sky behind the text layer's line (duet.tsx).
import type { Action } from '../keys';
import type { Grid } from '../grid';
import type { DuetDraw, FrameState, Pages, SceneName } from './common.ts';
import { space } from './common.ts';

/** The game is laid out on the tall grid too: the Game Boy held upright plays it on 320×288. */
export const TALL_SCENES: readonly SceneName[] = ['duet'];

export const PAGES: Pages = {};

/** The playfield's size in game pixels: the same on both grids, so a score means the same on a phone and a computer. */
export const FIELD = { w: 320, h: 288 } as const;

/** Where the playfield sits on a grid: its top left corner and its scale, the height filled. */
export interface Placement { x: number; y: number; scale: number }

/** The playfield on `grid`: scaled to the grid's height, centred across it. */
export function playfield(grid: Grid): Placement {
  const scale = grid.h / FIELD.h;
  return { x: (grid.w - FIELD.w * scale) / 2, y: 0, scale };
}

/** What the text layer shows of the run: its phase, the chapter, the lives left and the score. */
export interface DuetHud {
  phase: 'ready' | 'play';
  chapter: { numeral: string; name: string };
  lives: number;
  score: number;
}

/** What a press did to the game: B on the first ready screen leaves for the room, with no score. */
export interface DuetPressed { leave: boolean }

/**
 * The game itself, as the arcade drives it: stepped by the canvas loop with the buttons held, answering
 * presses, and read by the text layer through `hud()`.
 */
export interface DuetGame extends DuetDraw {
  /** Plays `dt` seconds with the buttons held, in the game's own fixed steps. */
  step(held: ReadonlySet<Action>, dt: number): void;
  press(action: Action): DuetPressed;
  hud(): DuetHud;
}

/** Where the game's import stands: on its way, the game ready, or the import failed. */
export type DuetStatus = 'loading' | 'ready' | 'failed';

/** What the arcade holds while the duet scene is up: where the import stands, the retries asked for, the grid it started on, the game once loaded and its text layer. */
export interface ArcadeDuet { status: DuetStatus; retry: number; grid: Grid; game: DuetGame | null; hud: DuetHud | null }

/** The line over the screen when the import failed. */
export const NOT_LOADED = 'GAME DID NOT LOAD · A TO RETRY';

/** The line while the game's code is on its way. */
export const LOADING_LINE = 'LOADING…';

/** What a ready screen says: the chapter, the lives left and what starts play. */
export function readyLine(hud: DuetHud): string {
  return `CHAPTER ${hud.chapter.numeral} · ${hud.chapter.name} · LIVES ×${hud.lives} · PRESS START`;
}

/** The game, loaded: what `import('arcade/duet/index')` gives. */
export type DuetModule = typeof import('../duet/index');

/**
 * Imports the game and makes it. A failed import (offline, or a chunk gone after a deploy) is logged
 * with `console.error` and answers null, so the screen can say so and A can try again.
 */
export async function loadDuet(load: () => Promise<Pick<DuetModule, 'createDuet'>>, seed = 1633): Promise<DuetGame | null> {
  try {
    return (await load()).createDuet({ seed });
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 * What a press does around the game: A imports again after a failure, B goes back to the room while
 * the game loads, failed, or waits on its first ready screen. Once play has started, B is the game's:
 * the rest of the buttons go to the game.
 */
export function duetPress(status: DuetStatus, action: Action, phase: DuetHud['phase'] = 'ready'): 'retry' | 'back' | null {
  if (action === 'b') return status !== 'ready' || phase === 'ready' ? 'back' : null;
  return status === 'failed' && action === 'a' ? 'retry' : null;
}

/** Whether two text layers say the same: the arcade re-renders only when they differ. */
export const sameDuetHud = (a: DuetHud | null, b: DuetHud | null): boolean =>
  a === b || (!!a && !!b && a.phase === b.phase && a.lives === b.lives && a.score === b.score
    && a.chapter.numeral === b.chapter.numeral && a.chapter.name === b.chapter.name);

/** The Omni sky over the whole grid, then the loaded game's playfield, placed for the grid and clipped to it. */
export function drawDuet(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.2);
  if (!s.duet) return; // loading, or failed: the sky behind the line
  const { x, y, scale } = playfield(s.grid);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, FIELD.w, FIELD.h);
  ctx.clip();
  s.duet.draw(ctx, s);
  ctx.restore();
}
