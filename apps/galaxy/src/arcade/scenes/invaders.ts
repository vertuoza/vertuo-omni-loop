// Entropy Invaders on the canvas: the player's own hero, in their fleet's colours, flying along the
// ground against the alien Entropy, one wound kind per row, over the shields. It draws the game the
// frame carries (`FrameState.game`), on the grid that game is laid out for: the wide field
// (640×360, 5 rows × 10, four shields) or the tall one (320×288, 5 rows × 6, three shields). The
// score line, the ready screen's score table, the pause and the game over are the text layer's
// (invaders.tsx).
import type { WoundKind } from '@omni/galaxy';
import { woundTint, type Tint } from '@omni/sprites';
import { alienAt, FIELDS } from '../games/invaders';
import { drawHero, frameOf, space, sprite, type FrameState, type Pages, type SceneName } from './common.ts';

/** The game is laid out on the tall grid too: its own field, six columns and three shields. */
export const TALL_SCENES: readonly SceneName[] = ['invaders'];

export const PAGES: Pages = {};

const SHIELD = '#1d8f55', SHIELD_TOP = '#4ee08a', GROUND = '#4ee08a', BOMB = '#ff3b5c', BOOM = '#ffd84a';

// One tint per kind, made once: the sprite cache keys on it every frame.
const tints = new Map<WoundKind, Tint>();
const tintOf = (kind: WoundKind) => {
  if (!tints.has(kind)) tints.set(kind, woundTint(kind));
  return tints.get(kind)!;
};

export function drawInvaders(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.2);
  const g = s.game;
  if (!g) return;
  const f = FIELDS[g.layout];

  // The ground the hero flies along.
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, f.ground, f.w, 2);
  ctx.globalAlpha = 1;

  // The shields, cell by cell; a cell with none above it catches the light.
  const { cell, cols } = f.shields;
  for (const sh of g.shields) {
    sh.cells.forEach((on, i) => {
      if (!on) return;
      const r = Math.floor(i / cols), c = i % cols;
      ctx.fillStyle = r === 0 || !sh.cells[i - cols] ? SHIELD_TOP : SHIELD;
      ctx.fillRect(sh.x + c * cell, sh.y + r * cell, cell, cell);
    });
  }

  // The formation: the sprites step with the march, two frames.
  const step = g.marchStep % 2;
  g.alive.forEach((on, i) => {
    if (!on) return;
    const row = Math.floor(i / g.cols);
    const a = alienAt(g, row, i % g.cols);
    sprite(ctx, s, 'entropy', a.x, a.y, { tint: tintOf(g.kinds[row]), frame: step });
  });

  // An alien hit bursts for a moment.
  ctx.fillStyle = BOOM;
  for (const b of g.booms) {
    const k = Math.min(1, (g.t - b.at) / 0.4);
    const r = Math.round(4 + k * 6);
    ctx.globalAlpha = 1 - k;
    ctx.fillRect(b.x - r, b.y - 1, r * 2, 2);
    ctx.fillRect(b.x - 1, b.y - r, 2, r * 2);
    ctx.fillRect(b.x - r / 2 - 1, b.y - r / 2 - 1, 3, 3);
    ctx.fillRect(b.x + r / 2 - 1, b.y + r / 2 - 1, 3, 3);
    ctx.fillRect(b.x + r / 2 - 1, b.y - r / 2 - 1, 3, 3);
    ctx.fillRect(b.x - r / 2 - 1, b.y + r / 2 - 1, 3, 3);
  }
  ctx.globalAlpha = 1;

  // The formation's bombs: a red zigzag.
  ctx.fillStyle = BOMB;
  for (const b of g.bombs) {
    for (let y = 0; y < f.bomb.h; y += 2) ctx.fillRect(b.x + ((y >> 2) % 2 ? 2 : 0), b.y + y, 2, 2);
  }

  // The hero's plasma bolt: white at the tip, plasma behind, with its glow.
  if (g.bolt) {
    const grad = ctx.createLinearGradient(0, g.bolt.y, 0, g.bolt.y + f.bolt.h);
    grad.addColorStop(0, '#f2f4ff');
    grad.addColorStop(1, s.theme.plasma);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = s.theme.plasma;
    ctx.fillRect(g.bolt.x - 4, g.bolt.y + 4, f.bolt.w + 8, f.bolt.h - 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fillRect(g.bolt.x, g.bolt.y, f.bolt.w, f.bolt.h);
  }

  // The hero, blinking while a hit keeps it out of reach.
  const blinking = g.t < g.hurtUntil && !g.over && Math.floor(g.t * 10) % 2 === 1;
  if (!blinking && !(g.over && g.lives <= 0)) drawHero(ctx, s, s.join.hero, s.join.team, g.heroX, f.hero.y, { frame: frameOf(s, 3) });
}
