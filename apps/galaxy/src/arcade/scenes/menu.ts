// The menu group on the canvas: the menu and How to play.
import { drawPlanet, drawSprite } from '@omni/sprites';
import { fleet, heroOf } from '../fleets';
import { frameOf, nebulaFor, RING, space, type FrameState } from './common.ts';

export function drawMenu(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.6);
  ctx.drawImage(nebulaFor('menu', 1, 440, 300), 240, 40);
  drawPlanet(ctx, { cx: 500, cy: 200, r: 104, seed: 2533, rot: s.reduced ? 1 : s.t * 0.05, progress: 0.66, atmosphere: '#8fd8ff', ring: RING });
  const y = 196 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 2) * 3));
  if (s.join.team) {
    const look = heroOf(s.join.hero, s.join.team);
    drawSprite(ctx, look.sprite, 552, y, { scale: 2, tint: look.tint, frame: frameOf(s, 1.5), glow: fleet(s.join.team).color });
  } else {
    drawSprite(ctx, 'omni', 552, y, { scale: 2, frame: frameOf(s, 1.5), glow: '#a45cff' });
  }
}

export function drawBriefing(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.3);
  ctx.drawImage(nebulaFor('briefing', 3, 400, 280), 280, 60);
}
