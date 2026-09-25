// Canvas scenes. The screen is 320×180 game pixels; the DOM overlays (text, panels) sit on top
// at 2× so type stays crisp. Every scene draws the whole frame from scratch.
import {
  drawPlanet, drawSprite, drawStarfield, makeNebula, makeStarfield, rng, spriteSize, WOUND_TINT,
} from '@omni/sprites';
import type { GalaxyView, Planet } from '@omni/galaxy';
import { fleet, seedOf } from './fleets';

export const W = 320;
export const H = 180;

export type SceneName = 'boot' | 'title' | 'menu' | 'map' | 'planet' | 'fleets' | 'heroes' | 'briefing';

export interface FrameState {
  scene: SceneName;
  view: GalaxyView;
  layout: MapSlot[];
  sel: number;          // selected planet index (map, planet)
  fleetSel: number;     // selected fleet index (fleets)
  t: number;            // seconds since start
  sceneT: number;       // seconds since this scene opened
  reduced: boolean;     // prefers-reduced-motion
}

export interface MapSlot { prd: number; x: number; y: number; r: number; index: number }

const stars = makeStarfield(11, W, H, 150);
let nebulae: Map<string, CanvasImageSource> | null = null;
const SECTOR_NEBULA = [
  ['#1a1050', '#34208a', '#5b35c4'],
  ['#0b2250', '#123e86', '#1f63c0'],
  ['#3a0f45', '#6a1e74', '#a0309e'],
  ['#0f3340', '#17566a', '#23808f'],
];

function nebulaFor(key: string, i: number, w: number, h: number) {
  nebulae ??= new Map();
  if (!nebulae.has(key)) nebulae.set(key, makeNebula(100 + i * 7, w, h, SECTOR_NEBULA[i % SECTOR_NEBULA.length], 0.75));
  return nebulae.get(key)!;
}

function space(ctx: CanvasRenderingContext2D, s: FrameState, speed = 0.4) {
  const bands = ['#07061c', '#0a0824', '#0d0a2c', '#110c34'];
  bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, (H / bands.length) * i, W, H / bands.length); });
  drawStarfield(ctx, stars, s.reduced ? 0 : s.t, { w: W, h: H, speed });
}

// ── Map layout ───────────────────────────────────────────────────────────────

export const MAP_TOP = 36;
export const MAP_BOTTOM = 130;

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
    const cellW = (colW - 12) / perRow;
    const cellH = (MAP_BOTTOM - MAP_TOP) / rows;
    const shrink = Math.min(1, cellH / 30, cellW / 30);
    members.forEach(({ p, index }, j) => {
      const r = Math.max(4, Math.round((5 + p.class * 2) * shrink));
      const rand = rng(seedOf(p.prd));
      const cx = ci * colW + 6 + cellW * ((j % perRow) + 0.5) + (rand() - 0.5) * Math.max(0, cellW - r * 2 - 6) * 0.6;
      const cy = MAP_TOP + cellH * (Math.floor(j / perRow) + 0.5) + (rand() - 0.5) * Math.max(0, cellH - r * 2 - 6) * 0.6;
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

function mood(p: Planet): 'alive' | 'lost' | 'locked' | 'ghost' {
  if (p.state === 'lost') return 'lost';
  if (p.state === 'locked') return 'locked';
  if (p.state === 'decommissioned' || (p.state === 'charted' && !p.regions.length)) return 'ghost';
  return 'alive';
}

const RING = ['#3a2a78', '#6a4fd0', '#a88cff', '#2a1f5c'];

function planetLook(p: Planet) {
  const alive = mood(p) === 'alive';
  return {
    seed: seedOf(p.prd),
    progress: p.progress,
    mood: mood(p),
    atmosphere: alive ? (p.progress >= 1 ? '#6ff0ff' : p.progress > 0 ? '#8fd8ff' : '#7a64b8') : null,
    ring: p.crossSector ? RING : null,
  };
}

function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  const m = r + 3 + (Math.floor(t * 4) % 2);
  ctx.fillStyle = '#ffd84a';
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = x + sx * m, cy = y + sy * m;
    ctx.fillRect(sx < 0 ? cx : cx - 3, cy, 4, 1);
    ctx.fillRect(cx, sy < 0 ? cy : cy - 3, 1, 4);
  }
}

function pulseRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string) {
  const k = (t * 0.8) % 1;
  const rr = r + 2 + k * 10;
  ctx.fillStyle = color;
  ctx.globalAlpha = 1 - k;
  const steps = Math.max(12, Math.round(rr * 4));
  for (let i = 0; i < steps; i += 2) {
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function dashedLine(ctx: CanvasRenderingContext2D, a: MapSlot, b: MapSlot, t: number) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const off = Math.floor(t * 8) % 6;
  ctx.fillStyle = '#ff3b5c';
  for (let d = a.r + 2 + off; d < len - b.r - 2; d += 6) {
    ctx.fillRect(Math.round(a.x + (dx * d) / len), Math.round(a.y + (dy * d) / len), 2, 1);
  }
}

// ── Scenes ───────────────────────────────────────────────────────────────────

function drawBoot(ctx: CanvasRenderingContext2D, s: FrameState) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  // The four Vertuoza stripes, growing in from the left like a loading bar.
  const colors = ['#ff3b5c', '#ff6a8a', '#b07cff', '#5b7bff'];
  const k = Math.min(1, s.sceneT / 0.9);
  colors.forEach((c, i) => {
    const w = Math.round((i % 2 ? 22 : 30) * Math.min(1, Math.max(0, k * 1.4 - i * 0.12)));
    ctx.fillStyle = c;
    ctx.fillRect(126 + (i % 2) * 8, 62 + i * 6, w, 3);
  });
}

function drawTitle(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 3);
  ctx.drawImage(nebulaFor('title', 0, 200, 120), 150, 0);
  ctx.drawImage(nebulaFor('title2', 2, 160, 100), -40, 40);
  const rot = s.reduced ? 0.6 : s.t * 0.05;
  drawPlanet(ctx, { cx: 20, cy: 214, r: 88, seed: 2332, rot, progress: 0.62, atmosphere: '#8fd8ff' });
  drawPlanet(ctx, { cx: 292, cy: 26, r: 16, seed: 985, rot: rot * 2, progress: 0, ring: RING, atmosphere: '#7a64b8' });
  const bob = (phase: number, amp = 2) => (s.reduced ? 0 : Math.round(Math.sin(s.t * 2 + phase) * amp));
  // Plasma trail under the commander.
  if (!s.reduced) {
    for (let i = 0; i < 18; i++) {
      const y = 132 + i * 2 + ((s.t * 40 + i * 7) % 4);
      ctx.fillStyle = i % 3 ? '#a45cff' : '#6ff0ff';
      ctx.globalAlpha = 1 - i / 18;
      ctx.fillRect(152 + ((i * 5) % 7) + bob(i, 1), y + bob(0), 2, 2);
      ctx.fillRect(164 - ((i * 3) % 6) + bob(i + 2, 1), y + bob(0), 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  drawSprite(ctx, 'omni', 136, 60 + bob(0), { scale: 3 });
  drawSprite(ctx, 'beaver', 56, 66 + bob(1), { scale: 2 });
  drawSprite(ctx, 'cia', 88, 104 + bob(2), { scale: 2 });
  drawSprite(ctx, 'invincible', 196, 106 + bob(3), { scale: 2 });
  drawSprite(ctx, 'octopod', 230, 62 + bob(4), { scale: 2 });
  drawSprite(ctx, 'picsou', 262, 104 + bob(5), { scale: 2, flip: true });
}

function drawStory(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 1);
  // Entropy marches across the bottom of the screen.
  const kinds = Object.keys(WOUND_TINT);
  for (let i = 0; i < 9; i++) {
    const x = ((i * 40 - s.sceneT * 18) % 360 + 360) % 360 - 20;
    const y = 150 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 3 + i) * 2));
    drawSprite(ctx, 'entropy', x, y, { tint: WOUND_TINT[kinds[i % kinds.length] as keyof typeof WOUND_TINT] });
  }
  drawPlanet(ctx, { cx: 286, cy: 40, r: 22, seed: 2410, rot: s.t * 0.1, progress: 0.15, atmosphere: '#7a64b8' });
}

function drawMenu(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.6);
  ctx.drawImage(nebulaFor('menu', 1, 220, 150), 120, 20);
  drawPlanet(ctx, { cx: 236, cy: 96, r: 52, seed: 2533, rot: s.reduced ? 1 : s.t * 0.12, progress: 0.66, atmosphere: '#8fd8ff', ring: RING });
  drawSprite(ctx, 'omni', 268, 108 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 2) * 2)), { scale: 2 });
}

function drawMap(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.15);
  const { view, layout } = s;
  const colW = W / Math.max(1, view.sectors.length);
  view.sectors.forEach((sec, i) => {
    ctx.drawImage(nebulaFor(`sector-${sec.name}`, i, Math.round(colW), 110), Math.round(i * colW), 20);
    if (i > 0) {
      ctx.fillStyle = '#23205a';
      for (let y = 22; y < 130; y += 4) ctx.fillRect(Math.round(i * colW), y, 1, 2);
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
    const rot = s.reduced ? look.seed % 7 : s.t * 0.25 + (look.seed % 7);
    if (p.state === 'distress' && !s.reduced) pulseRing(ctx, slot.x, slot.y, slot.r, s.t, '#ff3b5c');
    ctx.globalAlpha = look.mood === 'ghost' ? 0.55 : 1;
    drawPlanet(ctx, { cx: slot.x, cy: slot.y, r: slot.r, rot, ...look });
    ctx.globalAlpha = 1;
    // Entropy specks orbit the planets that carry open wounds.
    p.openWounds.slice(0, 6).forEach((w, i) => {
      const a = s.t * 1.2 + (i / Math.min(6, p.openWounds.length)) * Math.PI * 2;
      ctx.fillStyle = WOUND_TINT[w.kind].p;
      ctx.fillRect(Math.round(slot.x + Math.cos(a) * (slot.r + 4)) - 1, Math.round(slot.y + Math.sin(a) * (slot.r + 3)) - 1, 2, 2);
    });
    const icon = p.state === 'lost' ? 'skull' : p.state === 'locked' ? 'lock' : p.state === 'distress' ? 'beacon'
      : p.state === 'awaiting-command' ? 'flag' : null;
    if (icon && (p.state !== 'distress' || Math.floor(s.t * 3) % 2 === 0)) drawSprite(ctx, icon, slot.x - 4, slot.y - slot.r - 11);
    if ((p.state === 'terraformed') && Math.floor(s.t * 2 + slot.index) % 3 === 0) drawSprite(ctx, 'star', slot.x + slot.r - 1, slot.y - slot.r - 2);
    if (p.state === 'aftershock' && Math.floor(s.t * 3) % 2 === 0) drawSprite(ctx, 'fire', slot.x - 4, slot.y - slot.r - 11);
  }
  const cur = layout.find((l) => l.index === s.sel);
  if (cur) brackets(ctx, cur.x, cur.y, cur.r, s.t);
}

function drawPlanetScene(ctx: CanvasRenderingContext2D, s: FrameState) {
  const p = s.view.planets[s.sel];
  if (!p) return;
  const shake = p.state === 'aftershock' && !s.reduced && s.sceneT % 3 < 0.35 ? Math.round(Math.sin(s.t * 60) * 2) : 0;
  ctx.save();
  ctx.translate(shake, 0);
  space(ctx, s, 0.3);
  ctx.drawImage(nebulaFor('planet', 0, 180, 150), -20, 20);
  const cx = 88, cy = 102, r = 46;
  const look = planetLook(p);
  const rot = s.reduced ? 1 : s.t * 0.12 + (look.seed % 7);
  // Entropy units orbit on an ellipse: behind the planet first, then in front.
  const units = p.openWounds.slice(0, 8).map((w, i, arr) => ({ w, a: s.t * 0.5 + (i / arr.length) * Math.PI * 2 }));
  const orbit = (a: number) => ({ x: cx + Math.cos(a) * (r + 18) - 6, y: cy + Math.sin(a) * 16 - 6 });
  const drawUnit = ({ w, a }: { w: Planet['openWounds'][number]; a: number }) => {
    const o = orbit(a);
    drawSprite(ctx, 'entropy', o.x, o.y + (s.reduced ? 0 : Math.round(Math.sin(s.t * 4 + a) * 1)), { tint: WOUND_TINT[w.kind] });
  };
  units.filter((u) => Math.sin(u.a) < 0).forEach(drawUnit);
  if (p.state === 'distress' && !s.reduced) { pulseRing(ctx, cx, cy, r, s.t, '#ff3b5c'); pulseRing(ctx, cx, cy, r, s.t + 0.6, '#ff3b5c'); }
  ctx.globalAlpha = look.mood === 'ghost' ? 0.55 : 1;
  drawPlanet(ctx, { cx, cy, r, rot, ...look });
  ctx.globalAlpha = 1;
  units.filter((u) => Math.sin(u.a) >= 0).forEach(drawUnit);
  // Fleets on station: one ship per fleet with a zone claimed or secured here.
  const teams = [...new Set(p.zones.map((z) => z.team).filter((t): t is string => Boolean(t)))];
  teams.slice(0, 5).forEach((team, i) => {
    const a = -s.t * 0.7 + (i / Math.max(1, teams.length)) * Math.PI * 2;
    const x = cx + Math.cos(a) * (r + 30), y = cy - 4 + Math.sin(a) * 34;
    const f = fleet(team);
    const { w, h } = spriteSize(f.sprite);
    drawSprite(ctx, f.sprite, x - w / 2, y - h / 2 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 3 + i) * 1)));
  });
  if (p.state === 'lost') drawSprite(ctx, 'skull', cx - 8, cy - r - 22, { scale: 2 });
  if (p.state === 'locked') drawSprite(ctx, 'lock', cx - 8, cy - 8, { scale: 2 });
  if (p.state === 'terraformed' || p.state === 'awaiting-command') {
    for (let i = 0; i < 4; i++) if (Math.floor(s.t * 2 + i) % 4 === 0) drawSprite(ctx, 'star', cx - r + ((i * 37) % (r * 2)), cy - r + ((i * 53) % (r * 2)));
  }
  ctx.restore();
}

function drawFleets(ctx: CanvasRenderingContext2D, s: FrameState) {
  // A comic "hero select" wall: diagonal blue slabs behind the cards.
  ctx.fillStyle = '#0a1a4a';
  ctx.fillRect(0, 0, W, H);
  for (let i = -4; i < 16; i++) {
    ctx.fillStyle = i % 2 ? '#10266a' : '#0c1f58';
    ctx.beginPath();
    ctx.moveTo(i * 30, 0); ctx.lineTo(i * 30 + 30, 0); ctx.lineTo(i * 30 - 10, H); ctx.lineTo(i * 30 - 40, H);
    ctx.fill();
  }
  // Halftone dots.
  ctx.fillStyle = '#1b3a8f';
  for (let y = 2; y < H; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < W; x += 6) ctx.fillRect(x, y, 1, 1);
}

function drawHeroes(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.8);
  ctx.drawImage(nebulaFor('heroes', 2, 240, 160), 40, 10);
}

function drawBriefing(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.3);
  ctx.drawImage(nebulaFor('briefing', 3, 200, 140), 140, 30);
}

export function drawFrame(ctx: CanvasRenderingContext2D, s: FrameState, titlePhase: 'title' | 'story' | 'hiscore') {
  ctx.imageSmoothingEnabled = false;
  switch (s.scene) {
    case 'boot': return drawBoot(ctx, s);
    case 'title': return titlePhase === 'story' ? drawStory(ctx, s) : titlePhase === 'hiscore' ? drawHeroes(ctx, s) : drawTitle(ctx, s);
    case 'menu': return drawMenu(ctx, s);
    case 'map': return drawMap(ctx, s);
    case 'planet': return drawPlanetScene(ctx, s);
    case 'fleets': return drawFleets(ctx, s);
    case 'heroes': return drawHeroes(ctx, s);
    case 'briefing': return drawBriefing(ctx, s);
  }
}
