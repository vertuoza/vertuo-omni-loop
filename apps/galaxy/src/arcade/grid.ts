// The two grids a scene is drawn on, and which one each scene gets in each form. Every scene is
// authored for exactly 640×360 (wide) or 320×288 (tall), so type and sprites stay on a pixel grid;
// the screen scales the grid as one block.
//
// Shell first: a scene is tall only once its group lists it (`TALL_SCENES` in `scenes/<group>.ts`).
// Until then the Game Boy draws it on the wide grid, letterboxed inside its tall lens, so every
// scene stays reachable while the tall layouts land.
import type { GalaxyView } from '@omni/galaxy';
import type { Form } from './form';
import { TALL, WIDE, type Grid, type Pages, type SceneName } from './scenes/common.ts';
import * as attract from './scenes/attract.ts';
import * as chart from './scenes/chart.ts';
import * as fleets from './scenes/fleets.ts';
import * as games from './scenes/games.ts';
import * as invaders from './scenes/invaders.ts';
import * as join from './scenes/join.ts';
import * as map from './scenes/map.ts';
import * as menu from './scenes/menu.ts';
import * as planet from './scenes/planet.ts';
import * as recruit from './scenes/recruit.ts';

export { TALL, WIDE, type Grid, type GridName } from './scenes/common.ts';

const GROUPS = [attract, join, recruit, menu, map, planet, fleets, chart, games, invaders];

/** Every scene a group has laid out on the tall grid. */
export const TALL_SCENES: ReadonlySet<SceneName> = new Set(GROUPS.flatMap((g) => g.TALL_SCENES));

/** Every page count a group declares. */
export const PAGES: Pages = Object.assign({}, ...GROUPS.map((g) => g.PAGES));

/** The grid `scene` is drawn on in `form`: tall on the Game Boy held upright once its group lists it, wide otherwise. */
export function gridFor(form: Form, scene: SceneName, tall: ReadonlySet<SceneName> = TALL_SCENES): Grid {
  return form === 'handheld' && tall.has(scene) ? TALL : WIDE;
}

/** The shape of the screen in `form`: the lens is tall on the Game Boy, and a wide scene is letterboxed in it. */
export function frameFor(form: Form): Grid {
  return form === 'handheld' ? TALL : WIDE;
}

/** The pages `scene` takes on `grid`, as its group declares them: one, unless it says more. */
export function pagesFor(scene: SceneName, at: { view: GalaxyView | null; grid: Grid }, declared: Pages = PAGES): number {
  const count = declared[scene];
  if (!count || !at.view) return 1;
  return Math.max(1, Math.floor(count({ view: at.view, grid: at.grid })));
}

/** The page ◀ or ▶ turns to, of `pages`: round from the last page to the first, as the arcade's lists go. */
export function turnPage(page: number, pages: number, dir: 'left' | 'right'): number {
  if (pages < 2) return 0;
  const at = Math.min(page, pages - 1);
  return (at + (dir === 'left' ? pages - 1 : 1)) % pages;
}

export interface Fit { scale: number; w: number; h: number; x: number; y: number }

/**
 * `grid` at the largest scale that fits `box` and keeps its shape, fractions allowed, centred: the
 * bars on the two sides it does not reach are left to the box.
 */
export function fit(box: { w: number; h: number }, grid: { w: number; h: number }): Fit {
  const scale = Math.max(0, Math.min(box.w / grid.w, box.h / grid.h));
  const w = grid.w * scale, h = grid.h * scale;
  return { scale, w, h, x: (box.w - w) / 2, y: (box.h - h) / 2 };
}
