// The fleets wall on the canvas: the comic "hero select" wall the cards stand on. On the tall grid
// the wall is the same one, cut to the 320×288 screen: its slabs and dots keep their size in grid px.
import { heroSelectWall, type Grid, type Pages, type SceneName } from './common.ts';

/** `fleets` is laid out on the tall grid as well: the Game Boy held upright draws it there (grid.ts reads this list). */
export const TALL_SCENES: readonly SceneName[] = ['fleets'];
/**
 * The fleets wall is one page: ◀ ▶ pick the fleet, as on the wide wall. When more cards than fit
 * across the tall grid, the wall shows the ones around the selected fleet (`cardsShown`).
 */
export const PAGES: Pages = {};

/** The cards that fit across the tall grid, 320 grid px wide. */
const TALL_CARDS = 5;

/** The cards shown, `from` up to (not including) `to`, and which of the wall's `pages` of cards that is. */
export interface CardsShown { from: number; to: number; page: number; pages: number }

/**
 * The fleet cards the wall shows while fleet `index` of `count` is selected. The wide wall shows
 * every card; the tall one shows every card while five fit, and otherwise splits them into pages of
 * five at most, as even as they go, and shows the page that holds the selected fleet: ◀ ▶ reach
 * every fleet, page by page.
 */
export function cardsShown(grid: Grid, count: number, index: number): CardsShown {
  if (grid.name !== 'tall' || count <= TALL_CARDS) return { from: 0, to: count, page: 0, pages: 1 };
  const pages = Math.ceil(count / TALL_CARDS);
  const small = Math.floor(count / pages), big = small + 1, bigPages = count % pages; // the first pages take one more
  const at = Math.min(Math.max(0, index), count - 1);
  const page = at < bigPages * big ? Math.floor(at / big) : bigPages + Math.floor((at - bigPages * big) / small);
  const from = page < bigPages ? page * big : bigPages * big + (page - bigPages) * small;
  return { from, to: from + (page < bigPages ? big : small), page, pages };
}

export function drawFleets(ctx: CanvasRenderingContext2D) {
  heroSelectWall(ctx);
}
