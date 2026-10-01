// The recruit group on the canvas: the fleet select, the name entry and the hero builder, each on the
// wide grid and on the tall one (the Game Boy held upright), where the same parts stack.
import { rampFrom, spriteSize } from '@omni/design';
import { crewLook, fleet, SOLO } from '../fleets';
import {
  bobOf, drawFleetMascot, drawHero, flash, frameOf, heroSelectWall, nebulaFor, pedestal, space, sprite,
  type FrameState, type Grid, type Pages, type SceneName,
} from './common.ts';

/**
 * The recruit group's scenes laid out on the tall grid (`select`, `name`, `hero`). A scene not
 * listed is drawn on the wide grid, letterboxed in the Game Boy's lens (grid.ts reads this list).
 */
export const TALL_SCENES: readonly SceneName[] = ['select', 'name', 'hero'];
/** The recruit group's scenes are one page each. */
export const PAGES: Pages = {};

/** The fleet select's row of cards: which fleets it shows, and where. `lift` raises the one under the cursor. */
export interface CardRow { first: number; count: number; x0: number; y: number; w: number; h: number; gap: number; lift: number }

const CARDS = {
  wide: { w: 48, h: 46, gap: 10, y: 282, lift: 4 },
  tall: { w: 44, h: 42, gap: 6, y: 216, lift: 3 },
} as const;

/**
 * The fleet cards on `grid`, for `n` fleets with `pick` under the cursor. The wide grid shows every
 * fleet; the tall one shows as many as fit across it (six), a window that follows the cursor, so
 * ◀ ▶ reach every fleet. The text layer lays its card buttons over the same row.
 */
export function cardRow(n: number, pick: number, grid: Grid): CardRow {
  const c = CARDS[grid.name];
  const fits = Math.max(1, Math.floor((grid.w - 8 + c.gap) / (c.w + c.gap)));
  const count = grid.name === 'wide' ? n : Math.min(n, fits);
  const first = Math.max(0, Math.min(pick - Math.floor(count / 2), n - count));
  const x0 = Math.round(grid.w / 2 - (count * (c.w + c.gap) - c.gap) / 2);
  return { first, count, x0, ...c };
}

// Where the fleet select's mascot stands: centred, at 4× on the wide grid and 3× on the tall one.
const STAGE = {
  wide: { cx: 320, top: 40, bottom: 210, near: 30, far: 100, scale: 4, y: 72, pedestal: 200, rx: 76 },
  tall: { cx: 160, top: 28, bottom: 130, near: 20, far: 64, scale: 3, y: 30, pedestal: 128, rx: 56 },
} as const;

function comicWall(ctx: CanvasRenderingContext2D, color: string, stage: (typeof STAGE)[keyof typeof STAGE]) {
  heroSelectWall(ctx);
  // A spotlight in the fleet's colour, dithered.
  const { cx, top, bottom, near, far } = stage;
  const dark = rampFrom(color)[3]!;
  ctx.fillStyle = dark;
  for (let y = top; y < bottom; y += 2) {
    const half = near + ((y - top) / (bottom - top)) * (far - near);
    for (let x = Math.round(cx - half); x < cx + half; x += 2) if (!(((x + y) / 2) % 2)) ctx.fillRect(x, y, 2, 2);
  }
}

/**
 * The fleet select: the fleet under the cursor on its pedestal, and a card per active fleet, then the
 * PLAY SOLO card (PRD 400), at `pick` = `fleets.length`, where the player's own hero stands. With no
 * fleets, the wall alone: the text layer is the "raise your own" screen.
 */
export function drawSelect(ctx: CanvasRenderingContext2D, s: FrameState) {
  const { fleets, pick, lockedAt } = s.join;
  if (!fleets.length) { heroSelectWall(ctx); return; }
  const f = fleets[pick] ?? null;
  const color = f?.color ?? SOLO.color;
  const stage = STAGE[s.grid.name];
  comicWall(ctx, color, stage);
  const locked = lockedAt === null ? null : s.t - lockedAt;
  pedestal(ctx, stage.cx, stage.pedestal, stage.rx, color);
  const jump = locked !== null ? -Math.round(Math.abs(Math.sin(locked * 7)) * 18 * Math.max(0, 1 - locked / 1.4)) : bobOf(s, 0, 3);
  const pose = { scale: stage.scale, frame: frameOf(s, locked !== null ? 6 : 2.2) };
  if (f) drawFleetMascot(ctx, s, f.name, stage.cx - 16 * stage.scale, stage.y + jump, pose);
  else drawHero(ctx, s, s.join.hero, null, stage.cx - 16 * stage.scale, stage.y + jump, pose);
  const cards = [...fleets.map((fl) => ({ color: fl.color, look: fleet(fl.name) })), { color: SOLO.color, look: SOLO }];
  const row = cardRow(cards.length, pick, s.grid);
  const { w: cardW, h: cardH, gap } = row;
  cards.slice(row.first, row.first + row.count).forEach((card, k) => {
    const i = row.first + k;
    const on = i === pick, x = row.x0 + k * (cardW + gap), y = on ? row.y : row.y + row.lift;
    ctx.fillStyle = '#0b0a26'; ctx.fillRect(x + 2, y + 2, cardW, cardH);
    ctx.fillStyle = on ? rampFrom(card.color)[3]! : '#16195a'; ctx.fillRect(x, y, cardW, cardH);
    ctx.fillStyle = on ? card.color : '#2a2f7a';
    ctx.fillRect(x, y, cardW, 2); ctx.fillRect(x, y + cardH - 2, cardW, 2); ctx.fillRect(x, y, 2, cardH); ctx.fillRect(x + cardW - 2, y, 2, cardH);
    const look = card.look;
    const size = spriteSize(look.sprite);
    const tall = size.h > 32;
    const scale = tall ? 0.5 : 1;
    const at = s.grid.name === 'wide'
      ? { x: tall ? 16 : 8, y: tall ? 8 : 7 }
      : { x: Math.round((cardW - size.w * scale) / 2), y: Math.round((cardH - size.h * scale) / 2) };
    sprite(ctx, s, look.sprite, x + at.x, y + at.y, { scale, tint: look.tint ?? undefined, frame: on ? frameOf(s, 3) : 0, alpha: on ? 1 : 0.75 });
  });
  if (locked !== null) flash(ctx, color, 0.8 - locked * 2);
}

export function drawName(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.3);
  const tall = s.grid.name === 'tall';
  // Tall: the mascot stands bottom left, beside the badge and the line about the Hall of Heroes.
  if (tall) ctx.drawImage(nebulaFor('name-tall', 3, 300, 240), 10, 24);
  else ctx.drawImage(nebulaFor('name', 3, 480, 280), 80, 40);
  if (!s.join.team) return;
  const at = tall ? { x: 12, y: 170, pedestal: 234 } : { x: 40, y: 256, pedestal: 318 };
  pedestal(ctx, at.x + 32, at.pedestal, 34, crewLook(s.join.team).color);
  drawFleetMascot(ctx, s, s.join.team, at.x, at.y + bobOf(s, 0, 2), { scale: 2, frame: frameOf(s, 2) });
}

export function drawBuilder(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.2);
  const tall = s.grid.name === 'tall';
  // Tall: the hero at 2× in the left column, the rows beside it, as the wide grid has them.
  if (tall) ctx.drawImage(nebulaFor('hero-tall', 0, 200, 220), -50, 30);
  else ctx.drawImage(nebulaFor('hero', 0, 360, 300), -40, 30);
  const at = tall ? { cx: 44, y: 38, scale: 2, pedestal: 136, rx: 38 } : { cx: 148, y: 86, scale: 3, pedestal: 232, rx: 64 };
  pedestal(ctx, at.cx, at.pedestal, at.rx, crewLook(s.join.team).color);
  drawHero(ctx, s, s.join.hero, s.join.team, at.cx - 16 * at.scale, at.y + bobOf(s, 0, 2), { scale: at.scale, frame: frameOf(s, 2.2) });
}
