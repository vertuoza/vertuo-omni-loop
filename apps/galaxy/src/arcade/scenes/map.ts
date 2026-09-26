// The galaxy map on the canvas: where each planet sits, which planet the D-pad reaches next, and the
// map itself (the sectors, the hyperlanes, the distress pulses, the planets and their Entropy).
import { drawPlanet, rng, WOUND_TINT } from '@omni/sprites';
import type { GalaxyView } from '@omni/galaxy';
import { seedOf } from '../fleets';
import {
  frameOf, H, nebulaFor, planetLook, pulseRing, space, sprite, type FrameState, type Grid, type MapSlot, type Pages,
  type SceneName,
} from './common.ts';

/** The map is laid out on the tall grid: the Game Boy held upright draws it on 320×288 (grid.ts reads this list). */
export const TALL_SCENES: readonly SceneName[] = ['map'];
/** The map is one page. */
export const PAGES: Pages = {};

// ── Map layout ───────────────────────────────────────────────────────────────

// The band the planets sit in, between the HUD and the dialog, on the wide grid.
export const MAP_TOP = 72;
export const MAP_BOTTOM = 262;

/**
 * The tall map, top to bottom, in the tall grid's pixels: the HUD on two rows, the sector labels,
 * the planets' band, and the dialog. The text layer (map.css) keeps to the same lines.
 */
export const TALL_MAP = {
  /** The HUD's two rows end here; the sectors' nebulae start here. */
  hud: 22,
  /** The planets' band, their state icons included: under the sector labels… */
  top: 36,
  /** …and above the dialog, leaving the selected planet room for its tag under it. */
  bottom: 170,
  /** The room a state icon takes above its planet (drawMap draws it from y - r - 22). */
  icon: 22,
  /** The dialog's box starts no higher than this; the nebulae stop just above it. */
  dialog: 190,
} as const;

/** The planets of `sector`, in the galaxy's order: a planet with no sector sits in the first one. */
function membersOf(view: GalaxyView, sector: string) {
  return view.planets
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => (p.sector ?? view.sectors[0]?.name) === sector);
}

/**
 * Where each planet sits on the grid the map is drawn on, in that grid's pixels: the canvas draws
 * them there, the D-pad moves between them, and a tap on the screen finds them there.
 */
export function layoutMap(view: GalaxyView, grid: Grid): MapSlot[] {
  return grid.name === 'tall' ? layoutTall(view, grid) : layoutWide(view, grid);
}

function layoutWide(view: GalaxyView, grid: Grid): MapSlot[] {
  const top = (MAP_TOP * grid.h) / H, bottom = (MAP_BOTTOM * grid.h) / H;
  const cols = Math.max(1, view.sectors.length);
  const colW = grid.w / cols;
  const slots: MapSlot[] = [];
  view.sectors.forEach((sector, ci) => {
    const members = membersOf(view, sector.name);
    const k = members.length;
    if (!k) return;
    const perRow = k <= 2 ? 1 : 2;
    const rows = Math.ceil(k / perRow);
    const cellW = (colW - 24) / perRow;
    const cellH = (bottom - top) / rows;
    const shrink = Math.min(1, cellH / 62, cellW / 62);
    members.forEach(({ p, index }, j) => {
      const r = Math.max(8, Math.round((10 + p.class * 4) * shrink));
      const rand = rng(seedOf(p.prd));
      const cx = ci * colW + 12 + cellW * ((j % perRow) + 0.5) + (rand() - 0.5) * Math.max(0, cellW - r * 2 - 12) * 0.6;
      const cy = top + cellH * (Math.floor(j / perRow) + 0.5) + (rand() - 0.5) * Math.max(0, cellH - r * 2 - 12) * 0.6;
      slots.push({ prd: p.prd, x: Math.round(cx), y: Math.round(cy), r, index });
    });
  });
  return slots.sort((a, b) => a.index - b.index);
}

// The tall layout. Each sector keeps its column, as on the wide map, and its planets zigzag down it
// in lanes: planet j sits in lane j % lanes, one step lower than planet j - 1. Each planet owns a
// box, its lane's width by `lanes` steps tall, with its state icon at the top and its disc below:
// no two boxes share a pixel, so no two planets overlap and no icon lands on another planet. Every
// planet shrinks by the same factor, so its size still tells its class from one sector to the next:
// the factor the most crowded sector leaves room for. Each sector then takes the fewest lanes that
// leave its planets that room, so a sector with few planets runs straight down its column.

const PAD = 3; // between a column's edge and its outer lanes, inside the grid
const EDGE = 10; // at the grid's own edges, so the selection's brackets stay on the screen
const DRIFT = 8; // the most a planet drifts from the middle of its box
const baseRadius = (cls: number) => 10 + cls * 4; // the wide map's radius for a class, before it shrinks

interface Lanes { lanes: number; laneW: number; step: number; tall: number; room: number }

/**
 * The lanes `k` planets zigzag down in a column `width` wide, with the largest radius each has room
 * for: the fewest lanes that leave `need` of it, or else the lanes that leave the most.
 */
function lanesFor(k: number, width: number, need = Infinity): Lanes {
  const band = TALL_MAP.bottom - TALL_MAP.top;
  let best: Lanes | null = null;
  for (let lanes = 1; lanes <= Math.max(1, Math.min(k, 6)); lanes++) {
    const laneW = width / lanes;
    const step = band / (k - 1 + lanes);
    const tall = step * lanes;
    const room = Math.min(laneW / 2, (tall - TALL_MAP.icon) / 2) - 1;
    const it = { lanes, laneW, step, tall, room };
    if (room >= need) return it;
    if (!best || room > best.room) best = it;
  }
  return best!;
}

/** A planet's drift from the middle of its box, along one side of `slack` spare pixels. */
const drift = (rand: () => number, slack: number) => (rand() - 0.5) * 2 * Math.min(DRIFT, Math.max(0, slack / 2) * 0.8);

function layoutTall(view: GalaxyView, grid: Grid): MapSlot[] {
  const cols = Math.max(1, view.sectors.length);
  const colW = grid.w / cols;
  const sectors = view.sectors.map((sector, ci) => {
    const members = membersOf(view, sector.name);
    const left = ci * colW + (ci === 0 ? EDGE : PAD);
    const width = colW - (ci === 0 ? EDGE : PAD) - (ci === cols - 1 ? EDGE : PAD);
    return { members, left, width };
  }).filter((s) => s.members.length);
  const room = Math.floor(Math.min(...sectors.map((s) => lanesFor(s.members.length, s.width).room)));
  const shrink = Math.min(1, room / Math.max(...sectors.flatMap((s) => s.members.map(({ p }) => baseRadius(p.class)))));
  const slots: MapSlot[] = [];
  for (const { members, left, width } of sectors) {
    const { lanes, laneW, step, tall } = lanesFor(members.length, width, room);
    members.forEach(({ p, index }, j) => {
      const r = Math.max(1, Math.min(room, Math.max(6, Math.round(baseRadius(p.class) * shrink))));
      const discTop = TALL_MAP.top + j * step + TALL_MAP.icon; // the disc's part of the box, under the icon
      const discH = tall - TALL_MAP.icon;
      const rand = rng(seedOf(p.prd)); // the same drift for a planet on every run
      const cx = left + (j % lanes + 0.5) * laneW + drift(rand, laneW - r * 2 - 2);
      const cy = discTop + discH / 2 + drift(rand, discH - r * 2 - 2);
      slots.push({ prd: p.prd, x: Math.round(cx), y: Math.round(cy), r, index });
    });
  }
  return slots.sort((a, b) => a.index - b.index);
}

// The planet in `dir` from the current one that is closest, preferring straight lines.
export function neighbour<T extends Pick<MapSlot, 'x' | 'y' | 'index'>>(layout: T[], from: number, dir: 'up' | 'down' | 'left' | 'right'): number {
  const cur = layout.find((s) => s.index === from);
  if (!cur) return layout[0]?.index ?? 0;
  const [vx, vy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  let best: T | null = null;
  let bestScore = Infinity;
  for (const s of layout) {
    if (s.index === from) continue;
    const dx = s.x - cur.x, dy = s.y - cur.y;
    const along = dx * vx + dy * vy;
    if (along <= 0) continue;
    const across = Math.abs(dx * vy - dy * vx);
    const score = along + across * 2;
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best?.index ?? from;
}

// ── The map ──────────────────────────────────────────────────────────────────

/** The cursor's four blinking corners around a disc of radius `r`: the selected planet, sun or world. */
export function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string) {
  const m = r + 6 + (Math.floor(t * 4) % 2) * 2;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = x + sx * m, cy = y + sy * m;
    ctx.fillStyle = '#0b0a26';
    ctx.fillRect((sx < 0 ? cx : cx - 7) + 1, cy + 1, 8, 2);
    ctx.fillRect(cx + 1, (sy < 0 ? cy : cy - 7) + 1, 2, 8);
    ctx.fillStyle = color;
    ctx.fillRect(sx < 0 ? cx : cx - 7, cy, 8, 2);
    ctx.fillRect(cx, sy < 0 ? cy : cy - 7, 2, 8);
    ctx.fillStyle = '#fff4b0';
    ctx.fillRect(cx, cy, 2, 2);
  }
}

function dashedLine(ctx: CanvasRenderingContext2D, a: MapSlot, b: MapSlot, t: number, color: string) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const off = Math.floor(t * 16) % 12;
  for (let d = a.r + 6 + off; d < len - b.r - 6; d += 12) {
    const x = Math.round(a.x + (dx * d) / len), y = Math.round(a.y + (dy * d) / len);
    ctx.fillStyle = '#5a0818';
    ctx.fillRect(x, y + 1, 5, 2);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 5, 2);
  }
}

// Each sector's column on each grid: its nebula, from `top` and `h` tall, under the dashed line
// between two sectors, drawn from `from` down to `to`.
const SKY = {
  wide: { key: 'sector', top: 40, h: 220, from: 44, to: 262 },
  tall: { key: 'tall-sector', top: TALL_MAP.hud, h: TALL_MAP.dialog - 2 - TALL_MAP.hud, from: TALL_MAP.hud + 4, to: TALL_MAP.dialog - 2 },
} as const;

export function drawMap(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.15);
  const { view, layout } = s;
  if (!view) return;
  const sky = SKY[s.grid.name];
  const colW = s.grid.w / Math.max(1, view.sectors.length);
  view.sectors.forEach((sec, i) => {
    ctx.drawImage(nebulaFor(`${sky.key}-${sec.name}`, i, Math.round(colW), sky.h), Math.round(i * colW), sky.top);
    if (i > 0) {
      ctx.fillStyle = '#23205a';
      for (let y = sky.from; y < sky.to; y += 8) ctx.fillRect(Math.round(i * colW), y, 1, 4);
    }
  });
  const bySlot = new Map(layout.map((l) => [l.prd, l]));
  // Hyperlanes: a locked planet waits on the planets it is blocked by.
  for (const slot of layout) {
    const p = view.planets[slot.index];
    for (const b of p.blockers) { const to = bySlot.get(b); if (to) dashedLine(ctx, slot, to, s.t, s.theme.red); }
  }
  for (const slot of layout) {
    const p = view.planets[slot.index];
    const look = planetLook(p, s.theme);
    const rot = s.reduced ? look.seed % 7 : s.t * 0.15 + (look.seed % 7);
    if (p.state === 'distress' && !s.reduced) pulseRing(ctx, slot.x, slot.y, slot.r, s.t, s.theme.red);
    ctx.globalAlpha = look.mood === 'ghost' ? 0.55 : 1;
    drawPlanet(ctx, { cx: slot.x, cy: slot.y, r: slot.r, rot, ...look });
    ctx.globalAlpha = 1;
    // Entropy specks orbit the planets that carry open wounds.
    p.openWounds.slice(0, 6).forEach((w, i) => {
      const a = s.t * 1.2 + (i / Math.min(6, p.openWounds.length)) * Math.PI * 2;
      const x = Math.round(slot.x + Math.cos(a) * (slot.r + 8)) - 2, y = Math.round(slot.y + Math.sin(a) * (slot.r + 5)) - 2;
      ctx.fillStyle = '#0b0a26';
      ctx.fillRect(x - 1, y - 1, 6, 6);
      ctx.fillStyle = WOUND_TINT[w.kind].p;
      ctx.fillRect(x, y, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
    });
    const icon = p.state === 'lost' ? 'skull' : p.state === 'locked' ? 'lock' : p.state === 'distress' ? 'beacon'
      : p.state === 'awaiting-command' ? 'flag' : p.state === 'aftershock' ? 'fire' : null;
    if (icon) sprite(ctx, s, icon, slot.x - 8, slot.y - slot.r - 22, { frame: frameOf(s, 3, slot.index * 0.3) });
    if (p.state === 'terraformed' && Math.floor(s.t * 2 + slot.index) % 3 === 0) sprite(ctx, s, 'star', slot.x + slot.r - 6, slot.y - slot.r - 8, { frame: frameOf(s, 4) });
  }
  const cur = layout.find((l) => l.index === s.sel);
  if (cur) brackets(ctx, cur.x, cur.y, cur.r, s.t, s.theme.yellow);
}
