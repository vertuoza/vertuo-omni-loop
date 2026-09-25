// Canvas scenes. The screen is 640×360 game pixels, the same grid as the DOM overlays (text,
// panels) on top. Sprites draw at 1× in play so their detail shows; the title's hero shot uses 2×.
// Every scene draws the whole frame from scratch.
import {
  drawPlanet, drawSprite, drawStarfield, makeNebula, makeStarfield, rampFrom, rng, spriteSize, WOUND_TINT, woundTint, type Hero,
} from '@omni/sprites';
import type { GalaxyView, Planet } from '@omni/galaxy';
import { fleet, heroOf, seedOf } from './fleets';
import type { FleetRow } from './types';

export const W = 640;
export const H = 360;

export type SceneName =
  | 'boot' | 'title' | 'menu' | 'map' | 'planet' | 'fleets' | 'heroes' | 'briefing'
  | 'coin' | 'away' | 'gate' | 'intro' | 'select' | 'name' | 'hero' | 'link' | 'ready' | 'welcome' | 'outsider';

/** What the joining screens draw: the fleets to pick from, the player's fleet and hero. */
export interface JoinFrame {
  fleets: FleetRow[];     // the active fleets, in select order
  pick: number;           // the fleet under the cursor on the select screen
  lockedAt: number | null; // when the fleet was locked in (seconds, same clock as t)
  team: string | null;    // the player's fleet
  hero: Hero;             // the player's hero (the builder's draft on the builder)
  away: boolean;          // leaving the arcade for Google or GitHub
}

export interface FrameState {
  scene: SceneName;
  join: JoinFrame;
  view: GalaxyView | null;
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
  // The fleets fly in formation around the commander: the first five active ones.
  const spots = [[104, 124, 2, 0.3], [176, 208, 1.2, 0.5], [396, 212, 1.8, 0.1], [456, 116, 2.2, 0.7], [520, 206, 3, 0.2]] as const;
  s.join.fleets.slice(0, spots.length).forEach((f, i) => {
    const [x, y, rate, phase] = spots[i];
    const look = fleet(f.name);
    drawSprite(ctx, look.sprite, x, y + bob(i + 1) - (spriteSize(look.sprite).h - 32) * 2, { scale: 2, tint: look.tint ?? undefined, flip: i === 4, frame: frameOf(s, rate, phase) });
  });
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
  drawPlanet(ctx, { cx: 500, cy: 200, r: 104, seed: 2533, rot: s.reduced ? 1 : s.t * 0.05, progress: 0.66, atmosphere: '#8fd8ff', ring: RING });
  const y = 196 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 2) * 3));
  if (s.join.team) {
    const look = heroOf(s.join.hero, s.join.team);
    drawSprite(ctx, look.sprite, 552, y, { scale: 2, tint: look.tint, frame: frameOf(s, 1.5), glow: fleet(s.join.team).color });
  } else {
    drawSprite(ctx, 'omni', 552, y, { scale: 2, frame: frameOf(s, 1.5), glow: '#a45cff' });
  }
}

function drawMap(ctx: CanvasRenderingContext2D, s: FrameState) {
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

function drawPlanetScene(ctx: CanvasRenderingContext2D, s: FrameState) {
  const p = s.view?.planets[s.sel];
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
    drawSprite(ctx, f.sprite, x - w / 2, y - h / 2 + (s.reduced ? 0 : Math.round(Math.sin(s.t * 3 + i) * 2)), { tint: f.tint ?? undefined, frame: frameOf(s, 2, i * 0.4), flip: Math.cos(a) > 0 });
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

// ── Joining the game ─────────────────────────────────────────────────────────

const bobOf = (s: FrameState, phase: number, amp = 4) => (s.reduced ? 0 : Math.round(Math.sin(s.t * 2 + phase) * amp));

function drawFleetMascot(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, o: { scale?: number; frame?: number; alpha?: number; flip?: boolean } = {}) {
  const look = fleet(name);
  const lift = (spriteSize(look.sprite).h - 32) * (o.scale ?? 1); // a hero stand-in is taller than a mascot
  drawSprite(ctx, look.sprite, x, y - lift, { ...o, tint: look.tint ?? undefined });
}

function drawHero(ctx: CanvasRenderingContext2D, hero: Hero, team: string | null, x: number, y: number, o: { scale?: number; frame?: number; glow?: string | null } = {}) {
  const look = heroOf(hero, team);
  drawSprite(ctx, look.sprite, x, y, { ...o, tint: look.tint });
}

// A pedestal lit in a fleet's colour.
function pedestal(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, color: string) {
  const ramp = rampFrom(color);
  for (const [dy, tone] of [[3, 3], [0, 1]] as const) {
    ctx.fillStyle = ramp[tone];
    for (let y = -3; y <= 3; y++) {
      const w = Math.round(rx * Math.sqrt(1 - (y / 4) ** 2));
      ctx.fillRect(cx - w, cy + y + dy, w * 2, 1);
    }
  }
  ctx.fillStyle = ramp[0];
  ctx.fillRect(cx - Math.round(rx * 0.6), cy - 2, Math.round(rx * 0.5), 1);
}

function flash(ctx: CanvasRenderingContext2D, color: string, alpha: number) {
  if (alpha <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

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
function drawAway(ctx: CanvasRenderingContext2D, s: FrameState) {
  ctx.fillStyle = '#05040f';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i < Math.floor(s.sceneT * 8) % 13 ? '#6ff0ff' : '#1a1f55';
    ctx.fillRect(248 + i * 12, 230, 8, 8);
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, s: FrameState) {
  if (s.join.away) return drawAway(ctx, s);
  space(ctx, s, 0.5);
  ctx.drawImage(nebulaFor('coin', 1, 440, 300), 100, 20);
  drawSprite(ctx, 'coin', 288, 64 + bobOf(s, 0, 3), { scale: 4, frame: frameOf(s, 5) });
}

function drawGate(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.6);
  drawPlanet(ctx, { cx: 320, cy: 500, r: 190, seed: 2533, rot: s.reduced ? 1 : s.t * 0.03, progress: 0.4, atmosphere: '#8fd8ff' });
  drawSprite(ctx, 'omni', 304, 196 + bobOf(s, 0, 3), { frame: frameOf(s, 1.5), glow: '#a45cff' });
}

// The first visit's intro, timed to the intro theme's bars (score.ts): stripes 0–4 s, OMNI-MAN rises
// 4–8 s, three lines type in at 8, 10 and 12 s (DOM), the fleets flash in one per beat from 14 s.
function drawIntro(ctx: CanvasRenderingContext2D, s: FrameState) {
  const st = s.sceneT;
  if (st < 4) {
    drawBoot(ctx, { ...s, sceneT: Math.min(1, st / 1.6) * 0.9 });
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

function comicWall(ctx: CanvasRenderingContext2D, s: FrameState, color: string) {
  drawFleets(ctx, s);
  // A spotlight in the fleet's colour, dithered.
  const dark = rampFrom(color)[3];
  ctx.fillStyle = dark;
  for (let y = 40; y < 210; y += 2) {
    const half = 30 + ((y - 40) / 170) * 70;
    for (let x = Math.round(320 - half); x < 320 + half; x += 2) if (!(((x + y) / 2) % 2)) ctx.fillRect(x, y, 2, 2);
  }
}

function drawSelect(ctx: CanvasRenderingContext2D, s: FrameState) {
  const { fleets, pick, lockedAt } = s.join;
  const f = fleets[pick];
  if (!f) { drawFleets(ctx, s); return; }
  comicWall(ctx, s, f.color);
  const locked = lockedAt === null ? null : s.t - lockedAt;
  pedestal(ctx, 320, 200, 76, f.color);
  const jump = locked !== null ? -Math.round(Math.abs(Math.sin(locked * 7)) * 18 * Math.max(0, 1 - locked / 1.4)) : bobOf(s, 0, 3);
  drawFleetMascot(ctx, f.name, 256, 72 + jump, { scale: 4, frame: frameOf(s, locked !== null ? 6 : 2.2) });
  const cardW = 48, gap = 10, x0 = Math.round(320 - (fleets.length * (cardW + gap) - gap) / 2);
  fleets.forEach((fl, i) => {
    const on = i === pick, x = x0 + i * (cardW + gap), y = on ? 282 : 286;
    ctx.fillStyle = '#0b0a26'; ctx.fillRect(x + 2, y + 2, cardW, 46);
    ctx.fillStyle = on ? rampFrom(fl.color)[3] : '#16195a'; ctx.fillRect(x, y, cardW, 46);
    ctx.fillStyle = on ? fl.color : '#2a2f7a';
    ctx.fillRect(x, y, cardW, 2); ctx.fillRect(x, y + 44, cardW, 2); ctx.fillRect(x, y, 2, 46); ctx.fillRect(x + cardW - 2, y, 2, 46);
    const look = fleet(fl.name);
    const tall = spriteSize(look.sprite).h > 32;
    drawSprite(ctx, look.sprite, x + (tall ? 16 : 8), y + (tall ? 8 : 7), { scale: tall ? 0.5 : 1, tint: look.tint ?? undefined, frame: on ? frameOf(s, 3) : 0, alpha: on ? 1 : 0.75 });
  });
  if (locked !== null) flash(ctx, f.color, 0.8 - locked * 2);
}

function drawName(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.3);
  ctx.drawImage(nebulaFor('name', 3, 480, 280), 80, 40);
  if (!s.join.team) return;
  pedestal(ctx, 72, 318, 34, fleet(s.join.team).color);
  drawFleetMascot(ctx, s.join.team, 40, 256 + bobOf(s, 0, 2), { scale: 2, frame: frameOf(s, 2) });
}

function drawBuilder(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.2);
  ctx.drawImage(nebulaFor('hero', 0, 360, 300), -40, 30);
  pedestal(ctx, 148, 232, 64, fleet(s.join.team).color);
  drawHero(ctx, s.join.hero, s.join.team, 100, 86 + bobOf(s, 0, 2), { scale: 3, frame: frameOf(s, 2.2) });
}

function drawLink(ctx: CanvasRenderingContext2D, s: FrameState) {
  if (s.join.away) return drawAway(ctx, s);
  space(ctx, s, 0.4);
  ctx.drawImage(nebulaFor('link', 1, 360, 280), -30, 40);
  pedestal(ctx, 118, 256, 50, fleet(s.join.team).color);
  drawHero(ctx, s.join.hero, s.join.team, 86, 150 + bobOf(s, 0, 2), { scale: 2, frame: frameOf(s, 2) });
  if (s.join.team) drawFleetMascot(ctx, s.join.team, 150, 208 + bobOf(s, 1, 2), { frame: frameOf(s, 2.4) });
}

function drawReady(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 3);
  const y = 380 - Math.min(1, s.sceneT / 1.2) * 300 + (s.sceneT > 1.2 ? bobOf(s, 0, 3) : 0);
  plasmaTrail(ctx, s, 262, y + 92, 34);
  drawHero(ctx, s.join.hero, s.join.team, 240, y, { scale: 2, frame: frameOf(s, 2), glow: fleet(s.join.team).color });
  if (s.join.team) drawFleetMascot(ctx, s.join.team, 320, y + 40 + bobOf(s, 1, 3), { scale: 2, frame: frameOf(s, 2.5) });
}

function drawWelcome(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.8);
  ctx.drawImage(nebulaFor('welcome', 2, 480, 300), 80, 20);
  pedestal(ctx, 320, 262, 90, fleet(s.join.team).color);
  drawHero(ctx, s.join.hero, s.join.team, 244, 160 + bobOf(s, 0, 2), { scale: 2, frame: frameOf(s, 2) });
  if (s.join.team) drawFleetMascot(ctx, s.join.team, 334, 196 + bobOf(s, 1, 2), { scale: 2, frame: frameOf(s, 2.4) });
  for (let i = 0; i < 6; i++) if (Math.floor(s.t * 2 + i) % 3 === 0) drawSprite(ctx, 'star', 180 + ((i * 97) % 280), 120 + ((i * 53) % 140), { frame: frameOf(s, 4) });
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
    case 'coin': return drawCoin(ctx, s);
    case 'away': return drawAway(ctx, s);
    case 'gate': case 'outsider': return drawGate(ctx, s);
    case 'intro': return drawIntro(ctx, s);
    case 'select': return drawSelect(ctx, s);
    case 'name': return drawName(ctx, s);
    case 'hero': return drawBuilder(ctx, s);
    case 'link': return drawLink(ctx, s);
    case 'ready': return drawReady(ctx, s);
    case 'welcome': return drawWelcome(ctx, s);
  }
}
