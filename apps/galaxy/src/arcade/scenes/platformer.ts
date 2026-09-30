// Super Omni World on the arcade's canvas (PRD 817): nothing but the dark behind the game. The game
// draws itself, on its own Phaser canvas in the text layer's box (platformer/PlatformerScreen), and
// its text layer draws over that (platformer.tsx).
import type { FrameState, Pages, SceneName } from './common.ts';

/** The game is laid out on the tall grid too: the stage is 18 tiles high, the tall grid's height. */
export const TALL_SCENES: readonly SceneName[] = ['platformer'];

export const PAGES: Pages = {};

export function drawPlatformer(ctx: CanvasRenderingContext2D, s: FrameState) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, s.grid.w, s.grid.h);
}
