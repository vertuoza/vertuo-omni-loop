// The game room on the canvas: space and a nebula behind the cabinets, on the wide grid (640×360)
// and on the tall one (320×288). The cabinets, the XP bar and the words are the text layer's
// (games.tsx), laid out for each grid by games.css.
import { nebulaFor, space, type FrameState, type Pages, type SceneName } from './common.ts';

/**
 * The games group's scenes laid out on the tall grid. On it the room shows one cabinet a page, which
 * ◀ ▶ turn; on the wide grid the three stand side by side (grid.ts reads this list).
 */
export const TALL_SCENES: readonly SceneName[] = ['games'];

/**
 * No page count: the room's pages on the tall grid are its cabinets, and ◀ ▶ move the room's own
 * cursor (the cabinet under it on the wide grid, the page shown on the tall one), so turning the
 * phone keeps the cabinet chosen.
 */
export const PAGES: Pages = {};

// Where the nebula glows: behind the three cabinets on the wide grid, behind the one on the tall grid.
const NEBULA = {
  wide: { key: 'games', i: 2, x: 120, y: 70, w: 400, h: 260 },
  tall: { key: 'games-tall', i: 2, x: 40, y: 90, w: 240, h: 190 },
} as const;

export function drawGames(ctx: CanvasRenderingContext2D, s: FrameState) {
  const at = NEBULA[s.grid.name];
  space(ctx, s, 0.3);
  ctx.drawImage(nebulaFor(at.key, at.i, at.w, at.h), at.x, at.y);
}
