// The attract group on the canvas: the boot, the title's three phases (title, story, high scores)
// and the Hall of Heroes.
import { drawPlanet, drawSprite, spriteSize, WOUND_TINT, woundTint } from '@omni/sprites';
import { fleet } from '../fleets';
import { bootMark, frameOf, nebulaFor, plasmaTrail, RING, space, type FrameState, type Pages, type SceneName } from './common.ts';

/**
 * The attract group's scenes laid out on the tall grid (`boot`, `title`, `heroes`). A scene not
 * listed is drawn on the wide grid, letterboxed in the Game Boy's lens (grid.ts reads this list).
 */
export const TALL_SCENES: readonly SceneName[] = [];
/** How many pages a tall `heroes` takes, for ◀ ▶ to turn. Undeclared, it is one. */
export const PAGES: Pages = {};

export function drawBoot(ctx: CanvasRenderingContext2D, s: FrameState) {
  bootMark(ctx, s);
}

export function drawTitle(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 3);
  ctx.drawImage(nebulaFor('title', 0, 400, 240), 300, 0);
  ctx.drawImage(nebulaFor('title2', 2, 320, 200), -80, 80);
  const rot = s.reduced ? 0.6 : s.t * 0.02;
  drawPlanet(ctx, { cx: 40, cy: 440, r: 176, seed: 2332, rot, progress: 0.62, atmosphere: '#8fd8ff' });
  drawPlanet(ctx, { cx: 584, cy: 52, r: 30, seed: 985, rot: rot * 3, progress: 0, ring: RING, atmosphere: '#7a64b8' });
  const bob = (phase: number, amp = 4) => (s.reduced ? 0 : Math.round(Math.sin(s.t * 2 + phase) * amp));
  plasmaTrail(ctx, s, 310, 214 + bob(0), 30);
  drawSprite(ctx, 'omni', 288, 120 + bob(0), { scale: 2, frame: frameOf(s, 1.5), glow: '#a45cff' });
  // The fleets fly in formation around the commander: the first five active ones.
  const spots = [[104, 124, 2, 0.3], [176, 208, 1.2, 0.5], [396, 212, 1.8, 0.1], [456, 116, 2.2, 0.7], [520, 206, 3, 0.2]] as const;
  s.join.fleets.slice(0, spots.length).forEach((f, i) => {
    const [x, y, rate, phase] = spots[i];
    const look = fleet(f.name);
    drawSprite(ctx, look.sprite, x, y + bob(i + 1) - (spriteSize(look.sprite).h - 32) * 2, { scale: 2, tint: look.tint ?? undefined, flip: i === 4, frame: frameOf(s, rate, phase) });
  });
}

export function drawStory(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 1);
  // Entropy marches across the bottom of the screen.
  const kinds = Object.keys(WOUND_TINT) as (keyof typeof WOUND_TINT)[];
  for (let i = 0; i < 9; i++) {
    const x = ((i * 80 - s.sceneT * 36) % 720 + 720) % 720 - 40;
    const y = 296 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 3 + i) * 3));
    drawSprite(ctx, 'entropy', x, y, { tint: woundTint(kinds[i % kinds.length]), frame: frameOf(s, 3, i * 0.5) });
  }
  drawPlanet(ctx, { cx: 572, cy: 80, r: 44, seed: 2410, rot: s.t * 0.06, progress: 0.15, atmosphere: '#7a64b8' });
}

export function drawHeroes(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.8);
  ctx.drawImage(nebulaFor('heroes', 2, 480, 320), 80, 20);
}
