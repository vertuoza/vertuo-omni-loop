// The join group on the canvas: the coin, leaving the arcade, the gate (and the outsider's), the
// intro, the GitHub link, ready and welcome back.
import { drawPlanet, drawSprite } from '@omni/sprites';
import { fleet } from '../fleets';
import {
  bobOf, bootMark, drawFleetMascot, drawHero, flash, frameOf, H, nebulaFor, pedestal, plasmaTrail, space, stars, W, type FrameState,
} from './common.ts';

// Stars streaming down past the camera: the warp of the intro.
function warp(ctx: CanvasRenderingContext2D, s: FrameState, k: number) {
  ctx.fillStyle = '#07061c';
  ctx.fillRect(0, 0, W, H);
  for (const st of stars) {
    const v = (st.layer + 1) * 40 * k;
    const y = Math.floor((((st.y + (s.reduced ? 0 : s.t) * v) % H) + H) % H), len = Math.max(1, Math.round(v / 14));
    ctx.fillStyle = ['#2e3270', '#6a70c0', '#c8d0ff'][st.layer];
    ctx.fillRect(Math.floor(st.x), y - len, 1, len);
  }
}

// Leaving the arcade (for Google or GitHub): a loading bar on black.
export function drawAway(ctx: CanvasRenderingContext2D, s: FrameState) {
  ctx.fillStyle = '#05040f';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i < Math.floor(s.sceneT * 8) % 13 ? '#6ff0ff' : '#1a1f55';
    ctx.fillRect(248 + i * 12, 230, 8, 8);
  }
}

export function drawCoin(ctx: CanvasRenderingContext2D, s: FrameState) {
  if (s.join.away) return drawAway(ctx, s);
  space(ctx, s, 0.5);
  ctx.drawImage(nebulaFor('coin', 1, 440, 300), 100, 20);
  drawSprite(ctx, 'coin', 288, 64 + bobOf(s, 0, 3), { scale: 4, frame: frameOf(s, 5) });
}

export function drawGate(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.6);
  drawPlanet(ctx, { cx: 320, cy: 500, r: 190, seed: 2533, rot: s.reduced ? 1 : s.t * 0.03, progress: 0.4, atmosphere: '#8fd8ff' });
  drawSprite(ctx, 'omni', 304, 196 + bobOf(s, 0, 3), { frame: frameOf(s, 1.5), glow: '#a45cff' });
}

// The first visit's intro, timed to the intro theme's bars (score.ts): stripes 0–4 s, OMNI-MAN rises
// 4–8 s, three lines type in at 8, 10 and 12 s (DOM), the fleets flash in one per beat from 14 s.
export function drawIntro(ctx: CanvasRenderingContext2D, s: FrameState) {
  const st = s.sceneT;
  if (st < 4) {
    bootMark(ctx, { ...s, sceneT: Math.min(1, st / 1.6) * 0.9 });
    if (st > 2 && st < 2.15) flash(ctx, '#ffffff', 0.6);
    return;
  }
  const k = Math.min(1, (st - 4) / 1.5);
  warp(ctx, s, 0.4 + (st < 8 ? k * 2.4 : Math.max(0.3, 2.8 - (st - 8) * 0.8)));
  ctx.drawImage(nebulaFor('intro', 2, 420, 260), 110, 30);
  const y = st < 8 ? 380 - Math.min(1, (st - 4) / 3) * 330 : 50;
  plasmaTrail(ctx, s, 310, y + 94 + bobOf(s, 0), st < 8 ? 36 : 22);
  drawSprite(ctx, 'omni', 288, y + bobOf(s, 0, 3), { scale: 2, frame: frameOf(s, 1.5), glow: '#a45cff' });
  if (st > 14) {
    const fleets = s.join.fleets.slice(0, 5);
    const gap = W / Math.max(1, fleets.length);
    fleets.forEach((f, i) => {
      const at = 14 + i * 0.5;
      if (st < at) return;
      const x = Math.round(gap * (i + 0.5) - 32), top = 250;
      const jump = st < 18 || s.reduced ? 0 : -Math.round(Math.abs(Math.sin((st - 18) * 6 + i)) * 8);
      if (st < at + 0.12) { ctx.fillStyle = f.color; ctx.fillRect(x - 8, top - 8, 80, 80); }
      drawFleetMascot(ctx, f.name, x, top + jump, { scale: 2, frame: frameOf(s, 2.2, i * 0.4) });
    });
  }
  if (st > 19.4) flash(ctx, '#ffffff', (st - 19.4) * 1.6);
}

export function drawLink(ctx: CanvasRenderingContext2D, s: FrameState) {
  if (s.join.away) return drawAway(ctx, s);
  space(ctx, s, 0.4);
  ctx.drawImage(nebulaFor('link', 1, 360, 280), -30, 40);
  pedestal(ctx, 118, 256, 50, fleet(s.join.team).color);
  drawHero(ctx, s.join.hero, s.join.team, 86, 150 + bobOf(s, 0, 2), { scale: 2, frame: frameOf(s, 2) });
  if (s.join.team) drawFleetMascot(ctx, s.join.team, 150, 208 + bobOf(s, 1, 2), { frame: frameOf(s, 2.4) });
}

export function drawReady(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 3);
  const y = 380 - Math.min(1, s.sceneT / 1.2) * 300 + (s.sceneT > 1.2 ? bobOf(s, 0, 3) : 0);
  plasmaTrail(ctx, s, 262, y + 92, 34);
  drawHero(ctx, s.join.hero, s.join.team, 240, y, { scale: 2, frame: frameOf(s, 2), glow: fleet(s.join.team).color });
  if (s.join.team) drawFleetMascot(ctx, s.join.team, 320, y + 40 + bobOf(s, 1, 3), { scale: 2, frame: frameOf(s, 2.5) });
}

export function drawWelcome(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.8);
  ctx.drawImage(nebulaFor('welcome', 2, 480, 300), 80, 20);
  pedestal(ctx, 320, 262, 90, fleet(s.join.team).color);
  drawHero(ctx, s.join.hero, s.join.team, 244, 160 + bobOf(s, 0, 2), { scale: 2, frame: frameOf(s, 2) });
  if (s.join.team) drawFleetMascot(ctx, s.join.team, 334, 196 + bobOf(s, 1, 2), { scale: 2, frame: frameOf(s, 2.4) });
  for (let i = 0; i < 6; i++) if (Math.floor(s.t * 2 + i) % 3 === 0) drawSprite(ctx, 'star', 180 + ((i * 97) % 280), 120 + ((i * 53) % 140), { frame: frameOf(s, 4) });
}
