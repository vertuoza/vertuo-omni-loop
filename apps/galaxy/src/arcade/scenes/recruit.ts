// The recruit group on the canvas: the fleet select, the name entry and the hero builder.
import { drawSprite, rampFrom, spriteSize } from '@omni/sprites';
import { fleet } from '../fleets';
import {
  bobOf, drawFleetMascot, drawHero, flash, frameOf, heroSelectWall, nebulaFor, pedestal, space,
  type FrameState, type Pages, type SceneName,
} from './common.ts';

/**
 * The recruit group's scenes laid out on the tall grid (`select`, `name`, `hero`). A scene not
 * listed is drawn on the wide grid, letterboxed in the Game Boy's lens (grid.ts reads this list).
 */
export const TALL_SCENES: readonly SceneName[] = [];
/** The recruit group's scenes are one page each. */
export const PAGES: Pages = {};

function comicWall(ctx: CanvasRenderingContext2D, color: string) {
  heroSelectWall(ctx);
  // A spotlight in the fleet's colour, dithered.
  const dark = rampFrom(color)[3];
  ctx.fillStyle = dark;
  for (let y = 40; y < 210; y += 2) {
    const half = 30 + ((y - 40) / 170) * 70;
    for (let x = Math.round(320 - half); x < 320 + half; x += 2) if (!(((x + y) / 2) % 2)) ctx.fillRect(x, y, 2, 2);
  }
}

export function drawSelect(ctx: CanvasRenderingContext2D, s: FrameState) {
  const { fleets, pick, lockedAt } = s.join;
  const f = fleets[pick];
  if (!f) { heroSelectWall(ctx); return; }
  comicWall(ctx, f.color);
  const locked = lockedAt === null ? null : s.t - lockedAt;
  pedestal(ctx, 320, 200, 76, f.color);
  const jump = locked !== null ? -Math.round(Math.abs(Math.sin(locked * 7)) * 18 * Math.max(0, 1 - locked / 1.4)) : bobOf(s, 0, 3);
  drawFleetMascot(ctx, f.name, 256, 72 + jump, { scale: 4, frame: frameOf(s, locked !== null ? 6 : 2.2) });
  const cardW = 48, gap = 10, x0 = Math.round(320 - (fleets.length * (cardW + gap) - gap) / 2);
  fleets.forEach((fl, i) => {
    const on = i === pick, x = x0 + i * (cardW + gap), y = on ? 282 : 286;
    ctx.fillStyle = '#0b0a26'; ctx.fillRect(x + 2, y + 2, cardW, 46);
    ctx.fillStyle = on ? rampFrom(fl.color)[3] : '#16195a'; ctx.fillRect(x, y, cardW, 46);
    ctx.fillStyle = on ? fl.color : '#2a2f7a';
    ctx.fillRect(x, y, cardW, 2); ctx.fillRect(x, y + 44, cardW, 2); ctx.fillRect(x, y, 2, 46); ctx.fillRect(x + cardW - 2, y, 2, 46);
    const look = fleet(fl.name);
    const tall = spriteSize(look.sprite).h > 32;
    drawSprite(ctx, look.sprite, x + (tall ? 16 : 8), y + (tall ? 8 : 7), { scale: tall ? 0.5 : 1, tint: look.tint ?? undefined, frame: on ? frameOf(s, 3) : 0, alpha: on ? 1 : 0.75 });
  });
  if (locked !== null) flash(ctx, f.color, 0.8 - locked * 2);
}

export function drawName(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.3);
  ctx.drawImage(nebulaFor('name', 3, 480, 280), 80, 40);
  if (!s.join.team) return;
  pedestal(ctx, 72, 318, 34, fleet(s.join.team).color);
  drawFleetMascot(ctx, s.join.team, 40, 256 + bobOf(s, 0, 2), { scale: 2, frame: frameOf(s, 2) });
}

export function drawBuilder(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.2);
  ctx.drawImage(nebulaFor('hero', 0, 360, 300), -40, 30);
  pedestal(ctx, 148, 232, 64, fleet(s.join.team).color);
  drawHero(ctx, s.join.hero, s.join.team, 100, 86 + bobOf(s, 0, 2), { scale: 3, frame: frameOf(s, 2.2) });
}
