// Canvas scenes. The screen is 640×360 game pixels, the same grid as the DOM overlays (text,
// panels) on top. Sprites draw at 1× in play so their detail shows; the title's hero shot uses 2×.
// Every scene draws the whole frame from scratch.
import {
  drawPlanet, drawSprite, drawStarfield, makeNebula, makeStarfield, rng, spriteSize, WOUND_TINT, woundTint,
} from '@omni/sprites';
import type { GalaxyView, Planet } from '@omni/galaxy';
import { fleet, seedOf } from './fleets';

export const W = 640;
export const H = 360;

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

const stars = makeStarfield(11, W, H, 320);
let nebulae: Map<string, CanvasImageSource> | null = null;
const SECTOR_NEBULA = [
  ['#120b3a', '#1a1050', '#2a1a70', '#3e2896', '#5b35c4'],
  ['#08183c', '#0b2250', '#10346e', '#164c96', '#1f63c0'],
  ['#2a0a34', '#3a0f45', '#55185e', '#78247e', '#a0309e'],
  ['#0a2630', '#0f3340', '#144756', '#1a5f72', '#23808f'],
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

// Two-frame idle animation, shared by every sprite (still when motion is reduced).
const frameOf = (s: FrameState, rate = 2.5, phase = 0) => (s.reduced ? 0 : Math.floor(s.t * rate + phase) % 2);

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

function pulseRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string) {
  const k = (t * 0.8) % 1;
  const rr = r + 4 + k * 22;
  ctx.fillStyle = color;
  ctx.globalAlpha = 1 - k;
  const steps = Math.max(24, Math.round(rr * 5));
  for (let i = 0; i < steps; i += 2) {
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 2, 2);
  }
  ctx.globalAlpha = 1;
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

// ── Scenes ───────────────────────────────────────────────────────────────────

function drawBoot(ctx: CanvasRenderingContext2D, s: FrameState) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  // The four Vertuoza stripes, growing in from the left like a loading bar.
  const colors = [['#ff3b5c', '#a8183a'], ['#ff7aa8', '#b04a78'], ['#b07cff', '#6a2fd0'], ['#5b7bff', '#2f3fc4']];
  const k = Math.min(1, s.sceneT / 0.9);
  colors.forEach(([c, dark], i) => {
    const w = Math.round((i % 2 ? 44 : 60) * Math.min(1, Math.max(0, k * 1.4 - i * 0.12)));
    const x = 252 + (i % 2) * 16, y = 124 + i * 12;
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + 4, w, 2);
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, 4);
  });
}

function plasmaTrail(ctx: CanvasRenderingContext2D, s: FrameState, x: number, y: number, len: number) {
  if (s.reduced) return;
  for (let i = 0; i < len; i++) {
    const yy = y + i * 3 + ((s.t * 60 + i * 7) % 6);
    const w = Math.max(1, 4 - Math.floor(i / 8));
    ctx.globalAlpha = 1 - i / len;
    ctx.fillStyle = i % 3 ? '#a45cff' : '#6ff0ff';
    ctx.fillRect(x + ((i * 5) % 9) - 4, yy, w, w);
    ctx.fillStyle = i % 4 ? '#6a2fd0' : '#e2c6ff';
    ctx.fillRect(x + 20 - ((i * 3) % 9), yy + 2, w, w);
  }
  ctx.globalAlpha = 1;
}

function drawTitle(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 3);
  ctx.drawImage(nebulaFor('title', 0, 400, 240), 300, 0);
  ctx.drawImage(nebulaFor('title2', 2, 320, 200), -80, 80);
  const rot = s.reduced ? 0.6 : s.t * 0.02;
  drawPlanet(ctx, { cx: 40, cy: 440, r: 176, seed: 2332, rot, progress: 0.62, atmosphere: '#8fd8ff' });
  drawPlanet(ctx, { cx: 584, cy: 52, r: 30, seed: 985, rot: rot * 3, progress: 0, ring: RING, atmosphere: '#7a64b8' });
  const bob = (phase: number, amp = 4) => (s.reduced ? 0 : Math.round(Math.sin(s.t * 2 + phase) * amp));
  plasmaTrail(ctx, s, 310, 214 + bob(0), 30);
  drawSprite(ctx, 'omni', 288, 120 + bob(0), { scale: 2, frame: frameOf(s, 1.5), glow: '#a45cff' });
  drawSprite(ctx, 'beaver', 104, 124 + bob(1), { scale: 2, frame: frameOf(s, 2, 0.3) });
  drawSprite(ctx, 'cia', 176, 208 + bob(2), { scale: 2, frame: frameOf(s, 1.2, 0.5) });
  drawSprite(ctx, 'invincible', 396, 212 + bob(3), { scale: 2, frame: frameOf(s, 1.8, 0.1) });
  drawSprite(ctx, 'octopod', 456, 116 + bob(4), { scale: 2, frame: frameOf(s, 2.2, 0.7) });
  drawSprite(ctx, 'picsou', 520, 206 + bob(5), { scale: 2, flip: true, frame: frameOf(s, 3, 0.2) });
}

function drawStory(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 1);
  // Entropy marches across the bottom of the screen.
  const kinds = Object.keys(WOUND_TINT) as (keyof typeof WOUND_TINT)[];
  for (let i = 0; i < 9; i++) {
    const x = ((i * 80 - s.sceneT * 36) % 720 + 720) % 720 - 40;
    const y = 296 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 3 + i) * 3));
    drawSprite(ctx, 'entropy', x, y, { tint: woundTint(kinds[i % kinds.length]), frame: frameOf(s, 3, i * 0.5) });
  }
  drawPlanet(ctx, { cx: 572, cy: 80, r: 44, seed: 2410, rot: s.t * 0.06, progress: 0.15, atmosphere: '#7a64b8' });
}

function drawMenu(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.6);
  ctx.drawImage(nebulaFor('menu', 1, 440, 300), 240, 40);
  drawPlanet(ctx, { cx: 472, cy: 192, r: 104, seed: 2533, rot: s.reduced ? 1 : s.t * 0.05, progress: 0.66, atmosphere: '#8fd8ff', ring: RING });
  drawSprite(ctx, 'omni', 540, 212 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 2) * 3)), { scale: 2, frame: frameOf(s, 1.5), glow: '#a45cff' });
}

function drawMap(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.15);
  const { view, layout } = s;
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

function drawPlanetScene(ctx: CanvasRenderingContext2D, s: FrameState) {
  const p = s.view.planets[s.sel];
  if (!p) return;
  const shake = p.state === 'aftershock' && !s.reduced && s.sceneT % 3 < 0.35 ? Math.round(Math.sin(s.t * 60) * 3) : 0;
  ctx.save();
  ctx.translate(shake, 0);
  space(ctx, s, 0.3);
  ctx.drawImage(nebulaFor('planet', 0, 360, 300), -40, 40);
  const cx = 176, cy = 204, r = 92;
  const look = planetLook(p);
  const rot = s.reduced ? 1 : s.t * 0.05 + (look.seed % 7);
  // Entropy units orbit on an ellipse: behind the planet first, then in front.
  const units = p.openWounds.slice(0, 8).map((w, i, arr) => ({ w, i, a: s.t * 0.4 + (i / arr.length) * Math.PI * 2 }));
  const orbit = (a: number) => ({ x: cx + Math.cos(a) * (r + 34) - 12, y: cy + Math.sin(a) * 30 - 12 });
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
    const x = cx + Math.cos(a) * (r + 56), y = cy - 8 + Math.sin(a) * 68;
    const f = fleet(team);
    const { w, h } = spriteSize(f.sprite);
    drawSprite(ctx, f.sprite, x - w / 2, y - h / 2 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 3 + i) * 2)), { frame: frameOf(s, 2, i * 0.4), flip: Math.cos(a) > 0 });
  });
  if (p.state === 'lost') drawSprite(ctx, 'skull', cx - 16, cy - r - 44, { scale: 2 });
  if (p.state === 'locked') drawSprite(ctx, 'lock', cx - 16, cy - 16, { scale: 2 });
  if (p.state === 'terraformed' || p.state === 'awaiting-command') {
    for (let i = 0; i < 5; i++) if (Math.floor(s.t * 2 + i) % 4 === 0) drawSprite(ctx, 'star', cx - r + ((i * 71) % (r * 2)), cy - r + ((i * 103) % (r * 2)), { frame: frameOf(s, 4) });
  }
  ctx.restore();
}

function drawFleets(ctx: CanvasRenderingContext2D, s: FrameState) {
  // A comic "hero select" wall: diagonal blue slabs behind the cards, halftone dots on top.
  ctx.fillStyle = '#0a1a4a';
  ctx.fillRect(0, 0, W, H);
  for (let i = -4; i < 16; i++) {
    ctx.fillStyle = i % 2 ? '#10266a' : '#0c1f58';
    ctx.beginPath();
    ctx.moveTo(i * 60, 0); ctx.lineTo(i * 60 + 60, 0); ctx.lineTo(i * 60 - 20, H); ctx.lineTo(i * 60 - 80, H);
    ctx.fill();
  }
  ctx.fillStyle = '#1b3a8f';
  for (let y = 3; y < H; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < W; x += 8) ctx.fillRect(x, y, 2, 2);
}

function drawHeroes(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.8);
  ctx.drawImage(nebulaFor('heroes', 2, 480, 320), 80, 20);
}

function drawBriefing(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.3);
  ctx.drawImage(nebulaFor('briefing', 3, 400, 280), 280, 60);
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
