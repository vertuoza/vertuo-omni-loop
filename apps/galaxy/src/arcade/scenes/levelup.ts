// The level-up moment on the canvas: space, gold rays turning slowly behind the player's hero, a
// plasma burst breathing around it, the hero at 2× in their fleet's colours, and a white flash as it
// opens. With reduced motion the rays and the burst stand still and nothing flashes. LEVEL UP!, the
// level, the XP bar and NEW GAME UNLOCKED are the text layer's (levelup.tsx), laid out for each
// grid by levelup.css to match where this stands the hero.
import { bobOf, drawHero, frameOf, space, type FrameState, type GridName, type Pages, type SceneName } from './common.ts';

/** The level-up is laid out on the tall grid too: the same pieces, stacked in the narrower frame. */
export const TALL_SCENES: readonly SceneName[] = ['levelup'];

export const PAGES: Pages = {};

/** Where one grid stands the hero (drawn at 2×: 64×96) and the centre of the rays and the burst around it. */
interface Stage { cx: number; cy: number; hero: { x: number; y: number }; reach: number; burst: number }

const STAGES: Record<GridName, Stage> = {
  wide: { cx: 320, cy: 146, hero: { x: 288, y: 94 }, reach: 460, burst: 96 },
  tall: { cx: 160, cy: 106, hero: { x: 128, y: 58 }, reach: 300, burst: 70 },
};

const RAYS = 12;
const RAY_HALF = 0.09; // each ray's half width, in radians
const TURN = 24; // seconds for the rays to go round once
const FLASH = 0.25; // seconds the opening flash takes to fade

/** Twelve gold wedges out of the centre, turning once in TURN seconds; still with reduced motion. */
function rays(ctx: CanvasRenderingContext2D, s: FrameState, at: Stage) {
  const turn = s.reduced ? 0 : (s.sceneT / TURN) * Math.PI * 2;
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = s.theme.yellow;
  for (let i = 0; i < RAYS; i++) {
    const a = turn + (i / RAYS) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(at.cx, at.cy);
    ctx.lineTo(at.cx + Math.cos(a - RAY_HALF) * at.reach, at.cy + Math.sin(a - RAY_HALF) * at.reach);
    ctx.lineTo(at.cx + Math.cos(a + RAY_HALF) * at.reach, at.cy + Math.sin(a + RAY_HALF) * at.reach);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A disc of 2-pixel rows, so the glow stays on the pixel grid. */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  for (let y = -r; y < r; y += 2) {
    const w = Math.round(Math.sqrt(r * r - (y + 1) ** 2));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 2);
  }
}

/** The plasma burst around the hero, brighter towards its centre, breathing; still with reduced motion. */
function burst(ctx: CanvasRenderingContext2D, s: FrameState, at: Stage) {
  const breath = s.reduced ? 1 : 1 + Math.sin(s.sceneT * 4) * 0.06;
  ctx.fillStyle = s.theme.plasma;
  ctx.globalAlpha = 0.14;
  for (const k of [1, 0.74, 0.5, 0.3]) disc(ctx, at.cx, at.cy, Math.round(at.burst * k * breath));
  ctx.globalAlpha = 1;
}

export function drawLevelUp(ctx: CanvasRenderingContext2D, s: FrameState) {
  const at = STAGES[s.grid.name];
  space(ctx, s, 0.3);
  rays(ctx, s, at);
  burst(ctx, s, at);
  drawHero(ctx, s, s.join.hero, s.join.team, at.hero.x, at.hero.y + bobOf(s, 0, 3), { scale: 2, frame: frameOf(s, 2), glow: s.theme.yellow });
  // The screen flashes white as it opens: never with reduced motion.
  if (!s.reduced && s.sceneT < FLASH) {
    ctx.globalAlpha = 0.8 * (1 - s.sceneT / FLASH);
    ctx.fillStyle = s.theme.white;
    ctx.fillRect(0, 0, s.grid.w, s.grid.h);
    ctx.globalAlpha = 1;
  }
}
