// What the canvas scenes share. A scene is drawn on one of two grids: the wide one, 640×360 game
// pixels, or the tall one, 320×288 (a Game Boy screen at 2×), the same grid as the DOM overlays (text,
// panels) on top. `FrameState.grid` says which. Sprites draw at 1× in play so their detail shows; the
// title's hero shot uses 2×. Every scene draws the whole frame from scratch; each scene group draws
// its own in `scenes/<group>.ts`, and `scenes/index.ts` picks the one to draw. A colour that is a
// theme token is read from the frame's theme (`FrameState.theme`), never written here, and every
// sprite is drawn through `sprite()`, in the theme's stripes.
import {
  drawSprite, drawStarfield, makeNebula, makeStarfield, rampFrom, spriteSize, type Hero,
} from '@omni/sprites';
import type { GalaxyView, Planet } from '@omni/galaxy';
import { fleet, heroOf, seedOf } from '../fleets';
import type { Mark } from '../mark';
import { stripesOf, type Theme } from '../theme';
import type { FleetRow } from '../types';
import type { ChartLayout, ChartSource, SystemLayout } from './chart-layout.ts';

/** The wide grid's size: the grid every scene is drawn on until its group lays it out tall. */
export const W = 640;
export const H = 360;

export type GridName = 'wide' | 'tall';
export interface Grid { readonly name: GridName; readonly w: number; readonly h: number }

/** Today's 640×360 screen: on a computer, on the Advance body, and letterboxed in the Game Boy's lens. */
export const WIDE: Grid = { name: 'wide', w: W, h: H };
/** A Game Boy screen (160×144, 10:9) at 2×: the Game Boy held upright, for the scenes laid out on it. */
export const TALL: Grid = { name: 'tall', w: 320, h: 288 };

export type SceneName =
  | 'boot' | 'title' | 'menu' | 'map' | 'planet' | 'fleets' | 'heroes' | 'briefing'
  | 'coin' | 'away' | 'gate' | 'intro' | 'select' | 'name' | 'hero' | 'link' | 'ready' | 'welcome' | 'outsider'
  | 'chart' | 'system';

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
  grid: Grid;           // the grid this frame is drawn on (the canvas is its size)
  page: number;         // the page shown, on a scene its group splits into pages (0 otherwise)
  join: JoinFrame;
  view: GalaxyView | null;
  layout: MapSlot[];
  sel: number;          // selected planet index (map, planet)
  fleetSel: number;     // selected fleet index (fleets)
  t: number;            // seconds since start
  sceneT: number;       // seconds since this scene opened
  reduced: boolean;     // prefers-reduced-motion
  mark: Mark;           // the brand's mark: its letter, which the boot and the intro draw
  theme: Theme;         // the brand's theme, resolved: the colours the scenes draw with
  chart?: ChartFrame;   // the star chart (chart, system)
}

/** What the star chart's two scenes draw: the knowledge, its suns and the open system, laid out on the frame's grid. */
export interface ChartFrame {
  source: ChartSource;
  layout: ChartLayout;
  /** The system of the sun under the cursor. */
  system: SystemLayout | null;
  /** The sun under the cursor (chart), and the world (system). */
  sun: number;
  world: number;
}

export interface MapSlot { prd: number; x: number; y: number; r: number; index: number }

/**
 * How many pages a scene takes on a grid, for the galaxy it shows: a group that splits its tall
 * `briefing` or `heroes` into pages declares it in its `PAGES`, and ◀ ▶ turn them.
 */
export type PageCount = (at: { view: GalaxyView; grid: Grid }) => number;
export type Pages = Partial<Record<SceneName, PageCount>>;

export const stars = makeStarfield(11, W, H, 320);
let nebulae: Map<string, CanvasImageSource> | null = null;
const SECTOR_NEBULA = [
  ['#120b3a', '#1a1050', '#2a1a70', '#3e2896', '#5b35c4'],
  ['#08183c', '#0b2250', '#10346e', '#164c96', '#1f63c0'],
  ['#2a0a34', '#3a0f45', '#55185e', '#78247e', '#a0309e'],
  ['#0a2630', '#0f3340', '#144756', '#1a5f72', '#23808f'],
];

export function nebulaFor(key: string, i: number, w: number, h: number) {
  nebulae ??= new Map();
  if (!nebulae.has(key)) nebulae.set(key, makeNebula(100 + i * 7, w, h, SECTOR_NEBULA[i % SECTOR_NEBULA.length], 0.75));
  return nebulae.get(key)!;
}

export function space(ctx: CanvasRenderingContext2D, s: FrameState, speed = 0.4) {
  const { w, h } = s.grid;
  const bands = [s.theme.void, '#0a0824', '#0d0a2c', '#110c34'];
  bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, (h / bands.length) * i, w, h / bands.length); });
  drawStarfield(ctx, stars, s.reduced ? 0 : s.t, { w: W, h: H, speed });
}

function mood(p: Planet): 'alive' | 'lost' | 'locked' | 'ghost' {
  if (p.state === 'lost') return 'lost';
  if (p.state === 'locked') return 'locked';
  if (p.state === 'decommissioned' || (p.state === 'charted' && !p.regions.length)) return 'ghost';
  return 'alive';
}

export const RING = ['#3a2a78', '#6a4fd0', '#a88cff', '#2a1f5c'];

export function planetLook(p: Planet, theme: Theme) {
  const alive = mood(p) === 'alive';
  return {
    seed: seedOf(p.prd),
    progress: p.progress,
    mood: mood(p),
    atmosphere: alive ? (p.progress >= 1 ? theme.cyan : p.progress > 0 ? '#8fd8ff' : '#7a64b8') : null,
    ring: p.crossSector ? RING : null,
  };
}

// Two-frame idle animation, shared by every sprite (still when motion is reduced).
export const frameOf = (s: FrameState, rate = 2.5, phase = 0) => (s.reduced ? 0 : Math.floor(s.t * rate + phase) % 2);

export const bobOf = (s: FrameState, phase: number, amp = 4) => (s.reduced ? 0 : Math.round(Math.sin(s.t * 2 + phase) * amp));

export function pulseRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string) {
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

// The brand's mark at 2× on black, each row of bars growing in from the left like a loading bar:
// the boot screen, and the first bars of the intro. Each row starts a little after the one above it,
// the last one 0.36 of the reveal after the first, however many rows the letter has.
const REVEAL_LAG = 0.36;

export function bootMark(ctx: CanvasRenderingContext2D, s: FrameState) {
  const { size, runs, stops, shade } = s.mark;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const px = 2, x0 = W / 2 - (size * px) / 2, y0 = 96;
  const k = s.reduced ? 1 : Math.min(1, s.sceneT / 0.9);
  const gradient = (colors: Mark['stops']) => {
    const g = ctx.createLinearGradient(x0, 0, x0 + size * px, 0);
    for (const [offset, color] of colors) g.addColorStop(offset, color);
    return g;
  };
  const lag = REVEAL_LAG / Math.max(1, ...runs.map(([, , , row]) => row));
  const shown = runs.map(([x, y, w, row]) => {
    const reveal = size * Math.min(1, Math.max(0, k * 1.4 - row * lag));
    return [x, y, Math.round(Math.min(w, Math.max(0, reveal - x)))] as const;
  });
  for (const [fill, dy] of [[gradient(shade), 1], [gradient(stops), 0]] as const) {
    ctx.fillStyle = fill;
    for (const [x, y, w] of shown) ctx.fillRect(x0 + x * px, y0 + (y + dy) * px, w * px, px);
  }
}

export function plasmaTrail(ctx: CanvasRenderingContext2D, s: FrameState, x: number, y: number, len: number) {
  if (s.reduced) return;
  for (let i = 0; i < len; i++) {
    const yy = y + i * 3 + ((s.t * 60 + i * 7) % 6);
    const w = Math.max(1, 4 - Math.floor(i / 8));
    ctx.globalAlpha = 1 - i / len;
    ctx.fillStyle = i % 3 ? s.theme.plasma : s.theme.cyan;
    ctx.fillRect(x + ((i * 5) % 9) - 4, yy, w, w);
    ctx.fillStyle = i % 4 ? s.theme['plasma-dark'] : '#e2c6ff';
    ctx.fillRect(x + 20 - ((i * 3) % 9), yy + 2, w, w);
  }
  ctx.globalAlpha = 1;
}

// A comic "hero select" wall: diagonal blue slabs, halftone dots on top. The fleets' screen, and the
// fleet select behind its spotlight.
export function heroSelectWall(ctx: CanvasRenderingContext2D) {
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

/** How a sprite is drawn, but its stripes: those are the theme's. */
export type SpriteOptions = Omit<NonNullable<Parameters<typeof drawSprite>[4]>, 'flat'>;

/** A sprite on the canvas, in the theme's stripes (`stripe-1` to `stripe-4`): every scene draws its sprites through here. */
export function sprite(ctx: CanvasRenderingContext2D, s: FrameState, name: string, x: number, y: number, o: SpriteOptions = {}) {
  drawSprite(ctx, name, x, y, { ...o, flat: stripesOf(s.theme) });
}

export function drawFleetMascot(ctx: CanvasRenderingContext2D, s: FrameState, name: string, x: number, y: number, o: { scale?: number; frame?: number; alpha?: number; flip?: boolean } = {}) {
  const look = fleet(name);
  const lift = (spriteSize(look.sprite).h - 32) * (o.scale ?? 1); // a hero stand-in is taller than a mascot
  sprite(ctx, s, look.sprite, x, y - lift, { ...o, tint: look.tint ?? undefined });
}

export function drawHero(ctx: CanvasRenderingContext2D, s: FrameState, hero: Hero, team: string | null, x: number, y: number, o: { scale?: number; frame?: number; glow?: string | null } = {}) {
  const look = heroOf(hero, team);
  sprite(ctx, s, look.sprite, x, y, { ...o, tint: look.tint });
}

// A pedestal lit in a fleet's colour.
export function pedestal(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, color: string) {
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

export function flash(ctx: CanvasRenderingContext2D, color: string, alpha: number) {
  if (alpha <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}
