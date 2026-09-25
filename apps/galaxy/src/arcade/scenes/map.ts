// The galaxy map on the canvas: where each planet sits, which planet the D-pad reaches next, and the
// map itself (the sectors, the hyperlanes, the distress pulses, the planets and their Entropy).
import { drawPlanet, drawSprite, rng, WOUND_TINT } from '@omni/sprites';
import type { GalaxyView } from '@omni/galaxy';
import { seedOf } from '../fleets';
import { frameOf, nebulaFor, planetLook, pulseRing, space, W, type FrameState, type MapSlot } from './common.ts';

// ── Map layout ───────────────────────────────────────────────────────────────

export const MAP_TOP = 72;
export const MAP_BOTTOM = 262;

export function layoutMap(view: GalaxyView): MapSlot[] {
  const cols = Math.max(1, view.sectors.length);
  const colW = W / cols;
  const slots: MapSlot[] = [];
  view.sectors.forEach((sector, ci) => {
    const members = view.planets
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => (p.sector ?? view.sectors[0]?.name) === sector.name);
    const k = members.length;
    if (!k) return;
    const perRow = k <= 2 ? 1 : 2;
    const rows = Math.ceil(k / perRow);
    const cellW = (colW - 24) / perRow;
    const cellH = (MAP_BOTTOM - MAP_TOP) / rows;
    const shrink = Math.min(1, cellH / 62, cellW / 62);
    members.forEach(({ p, index }, j) => {
      const r = Math.max(8, Math.round((10 + p.class * 4) * shrink));
      const rand = rng(seedOf(p.prd));
      const cx = ci * colW + 12 + cellW * ((j % perRow) + 0.5) + (rand() - 0.5) * Math.max(0, cellW - r * 2 - 12) * 0.6;
      const cy = MAP_TOP + cellH * (Math.floor(j / perRow) + 0.5) + (rand() - 0.5) * Math.max(0, cellH - r * 2 - 12) * 0.6;
      slots.push({ prd: p.prd, x: Math.round(cx), y: Math.round(cy), r, index });
    });
  });
  return slots.sort((a, b) => a.index - b.index);
}

// The planet in `dir` from the current one that is closest, preferring straight lines.
export function neighbour(layout: MapSlot[], from: number, dir: 'up' | 'down' | 'left' | 'right'): number {
  const cur = layout.find((s) => s.index === from);
  if (!cur) return layout[0]?.index ?? 0;
  const [vx, vy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  let best: MapSlot | null = null;
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

function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  const m = r + 6 + (Math.floor(t * 4) % 2) * 2;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = x + sx * m, cy = y + sy * m;
    ctx.fillStyle = '#0b0a26';
    ctx.fillRect((sx < 0 ? cx : cx - 7) + 1, cy + 1, 8, 2);
    ctx.fillRect(cx + 1, (sy < 0 ? cy : cy - 7) + 1, 2, 8);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(sx < 0 ? cx : cx - 7, cy, 8, 2);
    ctx.fillRect(cx, sy < 0 ? cy : cy - 7, 2, 8);
    ctx.fillStyle = '#fff4b0';
    ctx.fillRect(cx, cy, 2, 2);
  }
}

function dashedLine(ctx: CanvasRenderingContext2D, a: MapSlot, b: MapSlot, t: number) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const off = Math.floor(t * 16) % 12;
  for (let d = a.r + 6 + off; d < len - b.r - 6; d += 12) {
    const x = Math.round(a.x + (dx * d) / len), y = Math.round(a.y + (dy * d) / len);
    ctx.fillStyle = '#5a0818';
    ctx.fillRect(x, y + 1, 5, 2);
    ctx.fillStyle = '#ff3b5c';
    ctx.fillRect(x, y, 5, 2);
  }
}

export function drawMap(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.15);
  const { view, layout } = s;
  if (!view) return;
  const colW = W / Math.max(1, view.sectors.length);
  view.sectors.forEach((sec, i) => {
    ctx.drawImage(nebulaFor(`sector-${sec.name}`, i, Math.round(colW), 220), Math.round(i * colW), 40);
    if (i > 0) {
      ctx.fillStyle = '#23205a';
      for (let y = 44; y < 262; y += 8) ctx.fillRect(Math.round(i * colW), y, 1, 4);
    }
  });
  const bySlot = new Map(layout.map((l) => [l.prd, l]));
  // Hyperlanes: a locked planet waits on the planets it is blocked by.
  for (const slot of layout) {
    const p = view.planets[slot.index];
    for (const b of p.blockers) { const to = bySlot.get(b); if (to) dashedLine(ctx, slot, to, s.t); }
  }
  for (const slot of layout) {
    const p = view.planets[slot.index];
    const look = planetLook(p);
    const rot = s.reduced ? look.seed % 7 : s.t * 0.15 + (look.seed % 7);
    if (p.state === 'distress' && !s.reduced) pulseRing(ctx, slot.x, slot.y, slot.r, s.t, '#ff3b5c');
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
    if (icon) drawSprite(ctx, icon, slot.x - 8, slot.y - slot.r - 22, { frame: frameOf(s, 3, slot.index * 0.3) });
    if (p.state === 'terraformed' && Math.floor(s.t * 2 + slot.index) % 3 === 0) drawSprite(ctx, 'star', slot.x + slot.r - 6, slot.y - slot.r - 8, { frame: frameOf(s, 4) });
  }
  const cur = layout.find((l) => l.index === s.sel);
  if (cur) brackets(ctx, cur.x, cur.y, cur.r, s.t);
}
