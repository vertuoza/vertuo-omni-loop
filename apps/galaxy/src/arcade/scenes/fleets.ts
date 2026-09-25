// The fleets wall on the canvas: the comic "hero select" wall the cards stand on.
import { heroSelectWall, type FrameState, type Pages, type SceneName } from './common.ts';

/**
 * `fleets`, once it is laid out on the tall grid. Until it is listed, it is drawn on the wide
 * grid, letterboxed in the Game Boy's lens (grid.ts reads this list).
 */
export const TALL_SCENES: readonly SceneName[] = [];
/** The fleets wall is one page. */
export const PAGES: Pages = {};

export function drawFleets(ctx: CanvasRenderingContext2D, s: FrameState) {
  heroSelectWall(ctx);
}
