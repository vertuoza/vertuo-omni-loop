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
import { overPress, type ScoreSend } from './invaders-score';

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

/**
 * What the text layer shows of the run: its phase, the chapter, whether it is in endless mode, the
 * wave (from 1) and how many the chapter has (none in endless mode), the lives left, the score, the
 * waves passed in the whole run, whether play has started, and the wave's line while it shows, in its
 * first seconds of play (issue 1692).
 */
export interface DuetHud {
  phase: 'ready' | 'play' | 'chapter' | 'paused' | 'over';
  chapter: { numeral: string; name: string };
  endless: boolean;
  wave: number;
  waves: number;
  lives: number;
  score: number;
  passed: number;
  started: boolean;
  line?: string;
}

/**
 * What a press did to the game: B on the first ready screen leaves for the room, with no score; the
 * run moved into `over` (SELECT on the pause, B on a later ready screen), its score reached to send;
 * A on the game over began again.
 */
export interface DuetPressed { leave: boolean; over: boolean; again: boolean }

/** What a step did: the last life was lost, and the run moved into `over`. */
export interface DuetStepped { over: boolean }

/**
 * The game itself, as the arcade drives it: stepped by the canvas loop with the buttons held, answering
 * presses, paused from outside, and read by the text layer through `hud()`.
 */
export interface DuetGame extends DuetDraw {
  /** Plays `dt` seconds with the buttons held, in the game's own fixed steps. */
  step(held: ReadonlySet<Action>, dt: number): DuetStepped;
  press(action: Action): DuetPressed;
  /** A pause from outside: a blurred window, a hidden tab, the scene left. Only START resumes. */
  pause(): void;
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

/** What endless mode is called on the ready screen and the HUD: twice the points. */
export const ENDLESS_TAG = 'ENDLESS ×2';

/** A ready screen's line in its two halves, the chapter (or endless mode) and then the lives and the call: the screen breaks it between them, never inside one. */
export function readyParts(hud: DuetHud): readonly [string, string] {
  const where = hud.endless ? ENDLESS_TAG : `CHAPTER ${hud.chapter.numeral} · ${hud.chapter.name}`;
  return [`${where} ·`, `LIVES ×${hud.lives} · PRESS START`];
}

/** What a ready screen says: the chapter or endless mode, the lives left and what starts play. */
export function readyLine(hud: DuetHud): string {
  return readyParts(hud).join(' ');
}

/** The HUD's chapter and wave: `CH II · 4/10`, or `ENDLESS ×2 · WAVE 12`. */
export const waveLine = (hud: DuetHud): string =>
  (hud.endless ? `${ENDLESS_TAG} · WAVE ${hud.wave}` : `CH ${hud.chapter.numeral} · ${hud.wave}/${hud.waves}`);

/** The banner a chapter opens with: `CHAPTER III · SPIN`, or `ENDLESS · ×2` after chapter IV. */
export const bannerLine = (hud: DuetHud): string => (hud.endless ? 'ENDLESS · ×2' : `CHAPTER ${hud.chapter.numeral} · ${hud.chapter.name}`);

/** The pause screen's title. */
export const PAUSED_LINE = 'PAUSED';

/** The game over's account of the run: the waves passed, and where it got to. */
export const overLines = (hud: DuetHud): readonly [string, string] => [`WAVES PASSED ${hud.passed}`, `REACHED ${waveLine(hud)}`];

/**
 * A on the game over, once its score has shown: true when it retries a send that failed and may be
 * tried once more; otherwise A is the game's (it plays again).
 */
export const duetRetry = (hud: DuetHud | null, send: ScoreSend | null, action: Action): boolean =>
  hud?.phase === 'over' && overPress(send, action) === 'retry';

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
 * the game loads or after it failed. Once it has loaded every press is the game's: B leaves from its
 * first ready screen, and ends the game once play has started.
 */
export function duetPress(status: DuetStatus, action: Action): 'retry' | 'back' | null {
  if (action === 'b') return status !== 'ready' ? 'back' : null;
  return status === 'failed' && action === 'a' ? 'retry' : null;
}

/** Whether two text layers say the same: the arcade re-renders only when they differ. */
export const sameDuetHud = (a: DuetHud | null, b: DuetHud | null): boolean =>
  a === b || (!!a && !!b && a.phase === b.phase && a.lives === b.lives && a.score === b.score
    && a.wave === b.wave && a.waves === b.waves && a.endless === b.endless && a.passed === b.passed && a.started === b.started
    && a.chapter.numeral === b.chapter.numeral && a.chapter.name === b.chapter.name && a.line === b.line);

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
