// The join group on the canvas: the coin, leaving the arcade, the gate (and the outsider's), the
// intro, the GitHub link, ready and welcome back. Each scene stands its pieces where its grid's
// stage says: the wide grid as it always was, or the tall one (the Game Boy held upright), where
// the same pieces stack in a narrower, taller frame.
import { drawPlanet } from '@omni/design';
import { fleet } from '../fleets';
import {
  bobOf, bootMark, drawFleetMascot, drawHero, flash, frameOf, H, nebulaFor, pedestal, plasmaTrail, space, sprite, stars, W,
  type FrameState, type GridName, type Pages, type SceneName,
} from './common.ts';

/**
 * The join group's scenes laid out on the tall grid. A scene not listed is drawn on the wide
 * grid, letterboxed in the Game Boy's lens (grid.ts reads this list).
 */
export const TALL_SCENES: readonly SceneName[] = ['coin', 'away', 'outsider', 'gate', 'intro', 'link', 'ready', 'welcome'];
/** The join group's scenes are one page each. */
export const PAGES: Pages = {};

interface At { x: number; y: number }
/** A nebula behind a scene: its own cache key per size, since the cache keeps one image per key. */
interface Nebula extends At { key: string; w: number; h: number }
interface Plinth { cx: number; cy: number; rx: number }

/** Where one grid stands the join scenes' pieces. The text over them is laid out to match in join.css. */
interface Stage {
  /** The loading bar while the player is away: its first block. */
  bar: At;
  coin: { nebula: Nebula; coin: At };
  /** The gate and the outsider: a planet rising at the bottom, OMNI-MAN above it. */
  gate: { planet: { cx: number; cy: number; r: number }; omni: At };
  /**
   * OMNI-MAN rises from `from` to `to`, then the fleets flash in, in a row from `left` to `right`,
   * every other one `stagger` lower, at `scale`.
   */
  intro: { nebula: Nebula; omniX: number; from: number; to: number; fleets: { left: number; right: number; top: number; stagger: number; scale: number } };
  link: { nebula: Nebula; pedestal: Plinth; hero: At & { scale: number }; mascot: At };
  /** The hero rises from `from` to `to`, the mascot beside it. */
  ready: { heroX: number; mascotX: number; from: number; to: number };
  /** The sparkles land inside `stars`. */
  welcome: { nebula: Nebula; pedestal: Plinth; hero: At; mascot: At; stars: At & { w: number; h: number } };
}

const STAGES: Record<GridName, Stage> = {
  wide: {
    bar: { x: 248, y: 230 },
    coin: { nebula: { key: 'coin', x: 100, y: 20, w: 440, h: 300 }, coin: { x: 288, y: 64 } },
    gate: { planet: { cx: 320, cy: 500, r: 190 }, omni: { x: 304, y: 196 } },
    intro: {
      nebula: { key: 'intro', x: 110, y: 30, w: 420, h: 260 }, omniX: 288, from: 380, to: 50,
      fleets: { left: 0, right: W, top: 250, stagger: 0, scale: 2 },
    },
    link: {
      nebula: { key: 'link', x: -30, y: 40, w: 360, h: 280 }, pedestal: { cx: 118, cy: 256, rx: 50 },
      hero: { x: 86, y: 150, scale: 2 }, mascot: { x: 150, y: 208 },
    },
    ready: { heroX: 240, mascotX: 320, from: 380, to: 80 },
    welcome: {
      nebula: { key: 'welcome', x: 80, y: 20, w: 480, h: 300 }, pedestal: { cx: 320, cy: 262, rx: 90 },
      hero: { x: 244, y: 160 }, mascot: { x: 334, y: 196 }, stars: { x: 180, y: 120, w: 280, h: 140 },
    },
  },
  // 320×288: the pieces sit higher and closer, the text above or below them (join.css), and the
  // intro's five fleets line up at 1× in a zigzag so their names never touch.
  tall: {
    bar: { x: 90, y: 196 },
    coin: { nebula: { key: 'coin-tall', x: 10, y: 0, w: 300, h: 220 }, coin: { x: 128, y: 22 } },
    gate: { planet: { cx: 160, cy: 410, r: 160 }, omni: { x: 144, y: 190 } },
    intro: {
      nebula: { key: 'intro-tall', x: 20, y: 10, w: 280, h: 200 }, omniX: 128, from: 300, to: 14,
      fleets: { left: 20, right: 300, top: 196, stagger: 16, scale: 1 },
    },
    link: {
      nebula: { key: 'link-tall', x: 50, y: -10, w: 220, h: 110 }, pedestal: { cx: 148, cy: 58, rx: 32 },
      hero: { x: 124, y: 6, scale: 1 }, mascot: { x: 156, y: 22 },
    },
    ready: { heroX: 80, mascotX: 160, from: 300, to: 64 },
    welcome: {
      nebula: { key: 'welcome-tall', x: 10, y: 40, w: 300, h: 220 }, pedestal: { cx: 160, cy: 230, rx: 80 },
      hero: { x: 84, y: 128 }, mascot: { x: 174, y: 164 }, stars: { x: 20, y: 96, w: 264, h: 120 },
    },
  },
};

const stageOf = (s: FrameState) => STAGES[s.grid.name];

// Stars streaming down past the camera: the warp of the intro.
function warp(ctx: CanvasRenderingContext2D, s: FrameState, k: number) {
  const { w, h } = s.grid;
  ctx.fillStyle = s.theme.void;
  ctx.fillRect(0, 0, w, h);
  for (const st of stars) {
    if (st.x >= w) continue;
    const v = (st.layer + 1) * 40 * k;
    const y = Math.floor((((st.y + (s.reduced ? 0 : s.t) * v) % h) + h) % h), len = Math.max(1, Math.round(v / 14));
    ctx.fillStyle = ['#2e3270', '#6a70c0', '#c8d0ff'][st.layer];
    ctx.fillRect(Math.floor(st.x), y - len, 1, len);
  }
}

// Leaving the arcade (for Google or GitHub): a loading bar on black.
export function drawAway(ctx: CanvasRenderingContext2D, s: FrameState) {
  const { bar } = stageOf(s);
  ctx.fillStyle = '#05040f';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i < Math.floor(s.sceneT * 8) % 13 ? s.theme.cyan : '#1a1f55';
    ctx.fillRect(bar.x + i * 12, bar.y, 8, 8);
  }
}

export function drawCoin(ctx: CanvasRenderingContext2D, s: FrameState) {
  if (s.join.away) return drawAway(ctx, s);
  const { nebula, coin } = stageOf(s).coin;
  space(ctx, s, 0.5);
  ctx.drawImage(nebulaFor(nebula.key, 1, nebula.w, nebula.h), nebula.x, nebula.y);
  sprite(ctx, s, 'coin', coin.x, coin.y + bobOf(s, 0, 3), { scale: 4, frame: frameOf(s, 5) });
}

export function drawGate(ctx: CanvasRenderingContext2D, s: FrameState) {
  const { planet, omni } = stageOf(s).gate;
  space(ctx, s, 0.6);
  drawPlanet(ctx, { ...planet, seed: 2533, rot: s.reduced ? 1 : s.t * 0.03, progress: 0.4, atmosphere: '#8fd8ff' });
  sprite(ctx, s, 'omni', omni.x, omni.y + bobOf(s, 0, 3), { frame: frameOf(s, 1.5), glow: s.theme.plasma });
}

// The first visit's intro, timed to the intro theme's bars (score.ts): stripes 0–4 s, OMNI-MAN rises
// 4–8 s, three lines type in at 8, 10 and 12 s (DOM), the fleets flash in one per beat from 14 s.
export function drawIntro(ctx: CanvasRenderingContext2D, s: FrameState) {
  const st = s.sceneT;
  const at = stageOf(s).intro;
  if (st < 4) {
    // The mark is drawn for the wide grid: on the tall one, its centre moves to the tall one's.
    const dx = (s.grid.w - W) / 2, dy = (s.grid.h - H) / 2;
    if (dx || dy) { ctx.save(); ctx.translate(dx, dy); }
    bootMark(ctx, { ...s, sceneT: Math.min(1, st / 1.6) * 0.9 });
    if (dx || dy) ctx.restore();
    if (st > 2 && st < 2.15) flash(ctx, '#ffffff', 0.6);
    return;
  }
  const k = Math.min(1, (st - 4) / 1.5);
  warp(ctx, s, 0.4 + (st < 8 ? k * 2.4 : Math.max(0.3, 2.8 - (st - 8) * 0.8)));
  ctx.drawImage(nebulaFor(at.nebula.key, 2, at.nebula.w, at.nebula.h), at.nebula.x, at.nebula.y);
  const y = st < 8 ? at.from - Math.min(1, (st - 4) / 3) * (at.from - at.to) : at.to;
  plasmaTrail(ctx, s, at.omniX + 22, y + 94 + bobOf(s, 0), st < 8 ? 36 : 22);
  sprite(ctx, s, 'omni', at.omniX, y + bobOf(s, 0, 3), { scale: 2, frame: frameOf(s, 1.5), glow: s.theme.plasma });
  if (st > 14) {
    const row = at.fleets, size = 32 * row.scale;
    const fleets = s.join.fleets.slice(0, 5);
    const gap = (row.right - row.left) / Math.max(1, fleets.length);
    fleets.forEach((f, i) => {
      const beat = 14 + i * 0.5;
      if (st < beat) return;
      const x = Math.round(row.left + gap * (i + 0.5) - size / 2), top = row.top + (i % 2) * row.stagger;
      const jump = st < 18 || s.reduced ? 0 : -Math.round(Math.abs(Math.sin((st - 18) * 6 + i)) * 4 * row.scale);
      if (st < beat + 0.12) { ctx.fillStyle = f.color; ctx.fillRect(x - 4 * row.scale, top - 4 * row.scale, size + 8 * row.scale, size + 8 * row.scale); }
      drawFleetMascot(ctx, s, f.name, x, top + jump, { scale: row.scale, frame: frameOf(s, 2.2, i * 0.4) });
    });
  }
  if (st > 19.4) flash(ctx, '#ffffff', (st - 19.4) * 1.6);
}

export function drawLink(ctx: CanvasRenderingContext2D, s: FrameState) {
  if (s.join.away) return drawAway(ctx, s);
  const { nebula, pedestal: p, hero, mascot } = stageOf(s).link;
  space(ctx, s, 0.4);
  ctx.drawImage(nebulaFor(nebula.key, 1, nebula.w, nebula.h), nebula.x, nebula.y);
  pedestal(ctx, p.cx, p.cy, p.rx, fleet(s.join.team).color);
  drawHero(ctx, s, s.join.hero, s.join.team, hero.x, hero.y + bobOf(s, 0, 2), { scale: hero.scale, frame: frameOf(s, 2) });
  if (s.join.team) drawFleetMascot(ctx, s, s.join.team, mascot.x, mascot.y + bobOf(s, 1, 2), { frame: frameOf(s, 2.4) });
}

export function drawReady(ctx: CanvasRenderingContext2D, s: FrameState) {
  const at = stageOf(s).ready;
  space(ctx, s, 3);
  const y = at.from - Math.min(1, s.sceneT / 1.2) * (at.from - at.to) + (s.sceneT > 1.2 ? bobOf(s, 0, 3) : 0);
  plasmaTrail(ctx, s, at.heroX + 22, y + 92, 34);
  drawHero(ctx, s, s.join.hero, s.join.team, at.heroX, y, { scale: 2, frame: frameOf(s, 2), glow: fleet(s.join.team).color });
  if (s.join.team) drawFleetMascot(ctx, s, s.join.team, at.mascotX, y + 40 + bobOf(s, 1, 3), { scale: 2, frame: frameOf(s, 2.5) });
}

export function drawWelcome(ctx: CanvasRenderingContext2D, s: FrameState) {
  const { nebula, pedestal: p, hero, mascot, stars: sky } = stageOf(s).welcome;
  space(ctx, s, 0.8);
  ctx.drawImage(nebulaFor(nebula.key, 2, nebula.w, nebula.h), nebula.x, nebula.y);
  pedestal(ctx, p.cx, p.cy, p.rx, fleet(s.join.team).color);
  drawHero(ctx, s, s.join.hero, s.join.team, hero.x, hero.y + bobOf(s, 0, 2), { scale: 2, frame: frameOf(s, 2) });
  if (s.join.team) drawFleetMascot(ctx, s, s.join.team, mascot.x, mascot.y + bobOf(s, 1, 2), { scale: 2, frame: frameOf(s, 2.4) });
  for (let i = 0; i < 6; i++) if (Math.floor(s.t * 2 + i) % 3 === 0) sprite(ctx, s, 'star', sky.x + ((i * 97) % sky.w), sky.y + ((i * 53) % sky.h), { frame: frameOf(s, 4) });
}
