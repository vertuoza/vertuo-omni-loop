// The planet on the canvas: the planet with its Entropy in orbit and its fleets on station.
import { drawPlanet, drawSprite, spriteSize, woundTint } from '@omni/sprites';
import type { Planet } from '@omni/galaxy';
import { fleet } from '../fleets';
import { frameOf, nebulaFor, planetLook, pulseRing, space, type FrameState, type Grid, type Pages, type SceneName } from './common.ts';

/** `planet` is laid out on the tall grid (grid.ts reads this list). */
export const TALL_SCENES: readonly SceneName[] = ['planet'];
/** The planet is one page: ◀ ▶ switch its tabs. */
export const PAGES: Pages = {};

/**
 * On the tall grid, the height of the band above the panel: the header on its left, the planet on
 * its right. The text layer puts the panel right under it (planet.tsx).
 */
export const TALL_BAND = 78;

/** Where the planet stands on a grid, and where its Entropy and its fleets fly around it. */
export interface PlanetStage {
  cx: number; cy: number; r: number;
  /** The ellipse the Entropy units orbit on. */
  orbit: { rx: number; ry: number };
  /** The ellipse the fleets on station fly on, its centre `dy` below the planet's. */
  station: { rx: number; ry: number; dy: number };
  /** The scale of the skull over a lost planet and the lock on a locked one. */
  mark: number;
  skull: { x: number; y: number };
  /** The side of the square a terraformed planet's stars twinkle in, from its top left. */
  sparkle: number;
  nebula: { x: number; y: number; w: number; h: number };
}

const WIDE_STAGE: PlanetStage = {
  cx: 176, cy: 204, r: 92,
  orbit: { rx: 126, ry: 30 },
  station: { rx: 148, ry: 68, dy: -8 },
  mark: 2,
  skull: { x: 160, y: 68 },
  sparkle: 184,
  nebula: { x: -40, y: 40, w: 360, h: 300 },
};

// The tall grid: a small planet in the band's right, from x 200, the header's edge, to the screen's.
const TALL_STAGE: PlanetStage = {
  cx: 260, cy: 39, r: 26,
  orbit: { rx: 40, ry: 8 },
  station: { rx: 44, ry: 13, dy: 0 },
  mark: 1,
  skull: { x: 252, y: 1 },
  sparkle: 36,
  nebula: { x: 170, y: -30, w: 180, h: 150 },
};

export const planetStage = (grid: Grid): PlanetStage => (grid.name === 'tall' ? TALL_STAGE : WIDE_STAGE);

export function drawPlanetScene(ctx: CanvasRenderingContext2D, s: FrameState) {
  const p = s.view?.planets[s.sel];
  if (!p) return;
  const shake = p.state === 'aftershock' && !s.reduced && s.sceneT % 3 < 0.35 ? Math.round(Math.sin(s.t * 60) * 3) : 0;
  ctx.save();
  ctx.translate(shake, 0);
  space(ctx, s, 0.3);
  const { cx, cy, r, orbit: ring, station, mark, skull, sparkle, nebula } = planetStage(s.grid);
  ctx.drawImage(nebulaFor(`planet-${s.grid.name}`, 0, nebula.w, nebula.h), nebula.x, nebula.y);
  const look = planetLook(p);
  const rot = s.reduced ? 1 : s.t * 0.05 + (look.seed % 7);
  // Entropy units orbit on an ellipse: behind the planet first, then in front.
  const units = p.openWounds.slice(0, 8).map((w, i, arr) => ({ w, i, a: s.t * 0.4 + (i / arr.length) * Math.PI * 2 }));
  const orbit = (a: number) => ({ x: cx + Math.cos(a) * ring.rx - 12, y: cy + Math.sin(a) * ring.ry - 12 });
  const drawUnit = ({ w, i, a }: { w: Planet['openWounds'][number]; i: number; a: number }) => {
    const o = orbit(a);
    drawSprite(ctx, 'entropy', o.x, o.y + (s.reduced ? 0 : Math.round(Math.sin(s.t * 4 + a) * 2)), { tint: woundTint(w.kind), frame: frameOf(s, 3, i * 0.4) });
  };
  units.filter((u) => Math.sin(u.a) < 0).forEach(drawUnit);
  if (p.state === 'distress' && !s.reduced) { pulseRing(ctx, cx, cy, r, s.t, '#ff3b5c'); pulseRing(ctx, cx, cy, r, s.t + 0.6, '#ff3b5c'); }
  ctx.globalAlpha = look.mood === 'ghost' ? 0.55 : 1;
  drawPlanet(ctx, { cx, cy, r, rot, ...look });
  ctx.globalAlpha = 1;
  units.filter((u) => Math.sin(u.a) >= 0).forEach(drawUnit);
  // Fleets on station: the hero of every fleet with a zone claimed or secured here.
  const teams = [...new Set(p.zones.map((z) => z.team).filter((t): t is string => Boolean(t)))];
  teams.slice(0, 5).forEach((team, i) => {
    const a = -s.t * 0.35 + (i / Math.max(1, teams.length)) * Math.PI * 2;
    const x = cx + Math.cos(a) * station.rx, y = cy + station.dy + Math.sin(a) * station.ry;
    const f = fleet(team);
    const { w, h } = spriteSize(f.sprite);
    drawSprite(ctx, f.sprite, x - w / 2, y - h / 2 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 3 + i) * 2)), { tint: f.tint ?? undefined, frame: frameOf(s, 2, i * 0.4), flip: Math.cos(a) > 0 });
  });
  if (p.state === 'lost') drawSprite(ctx, 'skull', skull.x, skull.y, { scale: mark });
  if (p.state === 'locked') drawSprite(ctx, 'lock', cx - 8 * mark, cy - 8 * mark, { scale: mark });
  if (p.state === 'terraformed' || p.state === 'awaiting-command') {
    for (let i = 0; i < 5; i++) if (Math.floor(s.t * 2 + i) % 4 === 0) drawSprite(ctx, 'star', cx - r + ((i * 71) % sparkle), cy - r + ((i * 103) % sparkle), { frame: frameOf(s, 4) });
  }
  ctx.restore();
}
