// The menu group on the canvas: the menu and How to play, on the wide grid and on the tall one.
import { drawPlanet } from '@omni/design';
import { fleet, heroOf } from '../fleets';
import { frameOf, nebulaFor, RING, space, sprite, type FrameState, type Pages, type SceneName } from './common.ts';

/**
 * The menu group's scenes laid out on the tall grid (`menu`, `briefing`). A scene not listed is
 * drawn on the wide grid, letterboxed in the Game Boy's lens (grid.ts reads this list).
 */
export const TALL_SCENES: readonly SceneName[] = ['menu', 'briefing'];

/**
 * How to play's sections, one page each on the tall grid: what earns points, the Entropy that costs
 * them, and the levels XP reaches. The wide grid lays all three out on one page: the first two side
 * by side, the levels under them.
 */
export const BRIEFING_PAGES = ['earn', 'entropy', 'levels'] as const;
export type BriefingPage = (typeof BRIEFING_PAGES)[number];

/** How many pages a tall `briefing` takes, for ◀ ▶ to turn: a section each. */
export const PAGES: Pages = {
  briefing: ({ grid }) => (grid.name === 'tall' ? BRIEFING_PAGES.length : 1),
};

// Where the menu's planet turns, and where the player's hero (or OmniMan) stands on it: on the wide
// grid beside the list, on the tall one in the corner the heading leaves free.
const MENU_PLANET = {
  wide: { cx: 500, cy: 200, r: 104, hero: { x: 552, y: 196, scale: 2 }, nebula: { x: 240, y: 40, w: 440, h: 300 } },
  tall: { cx: 290, cy: 30, r: 34, hero: { x: 272, y: 6, scale: 1 }, nebula: { x: 120, y: 0, w: 220, h: 150 } },
} as const;

export function drawMenu(ctx: CanvasRenderingContext2D, s: FrameState) {
  const at = MENU_PLANET[s.grid.name];
  space(ctx, s, 0.6);
  ctx.drawImage(nebulaFor(s.grid.name === 'tall' ? 'menu-tall' : 'menu', 1, at.nebula.w, at.nebula.h), at.nebula.x, at.nebula.y);
  drawPlanet(ctx, { cx: at.cx, cy: at.cy, r: at.r, seed: 2533, rot: s.reduced ? 1 : s.t * 0.05, progress: 0.66, atmosphere: '#8fd8ff', ring: RING });
  const y = at.hero.y + (s.reduced ? 0 : Math.round(Math.sin(s.t * 2) * 3));
  if (s.join.team) {
    const look = heroOf(s.join.hero, s.join.team);
    sprite(ctx, s, look.sprite, at.hero.x, y, { scale: at.hero.scale, tint: look.tint, frame: frameOf(s, 1.5), glow: fleet(s.join.team).color });
  } else {
    sprite(ctx, s, 'omni', at.hero.x, y, { scale: at.hero.scale, frame: frameOf(s, 1.5), glow: s.theme.plasma });
  }
}

export function drawBriefing(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.3);
  if (s.grid.name === 'tall') ctx.drawImage(nebulaFor('briefing-tall', 3, 260, 200), 60, 88);
  else ctx.drawImage(nebulaFor('briefing', 3, 400, 280), 280, 60);
}
