import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME } from '../theme';
import { markFor } from '../mark';
import { TALL, WIDE, type FrameState, type Grid } from '../scenes/common.ts';
import type { Action } from '../keys';
import { createKart, KART_W, minimapAt } from './art';
import { parseTrack } from './track';

// What the player sees of its own drift's sparks (issue 2057): a canvas that keeps, for every pixel, what was painted on it last.
// The kart's sprite and the driver cover their whole rectangle; the designs' sprites are stubbed out, as art.test.ts does.
type Paint = { kind: 'fill'; style: string; rect: number[] } | { kind: 'sprite'; name: string; x: number; y: number; scale: number } | { kind: 'image'; at: number[] };
const paints = vi.hoisted(() => [] as unknown[]);
vi.mock('@omni/design', async (original) => {
  const m = await original<typeof import('@omni/design')>();
  return {
    ...m,
    drawPlanet: () => {},
    drawStarfield: () => {},
    makeNebula: () => ({}),
    spriteImage: () => ({ width: 32, height: 48 }),
    drawSprite: (_ctx: unknown, name: string, x: number, y: number, o: { scale?: number } = {}) => { paints.push({ kind: 'sprite', name, x, y, scale: o.scale ?? 1 }); },
  };
});

class FakeImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); }
}

beforeEach(() => {
  paints.length = 0;
  vi.stubGlobal('ImageData', FakeImageData);
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData: () => {} }) }) });
});
afterEach(() => { vi.unstubAllGlobals(); });

/** A canvas that records what it is asked to paint, in order. */
function canvas(): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = {};
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'fillRect') return (...rect: number[]) => { paints.push({ kind: 'fill', style: String(state['fillStyle']), rect }); };
      if (prop === 'drawImage') return (_image: unknown, ...at: number[]) => { paints.push({ kind: 'image', at }); };
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

/** The kart sprite's height, in sprite pixels. */
const KART_H = 18;

/** COMET RING, the circuit the race below runs on: its minimap is framed in the sparks' colour. */
const track = parseTrack();

/** How many pixels of the screen show, at the end of a frame, a square of `colour` (a blue spark, or the still glow that stands for it); the minimap is left out. */
function shownOf(grid: Grid, colour: string): number {
  const last = new Uint8Array(grid.w * grid.h);
  const paint = (x0: number, y0: number, w: number, h: number, spark: boolean) => {
    const left = Math.max(0, Math.round(x0)), right = Math.min(grid.w, Math.round(x0 + w));
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(grid.h, Math.round(y0 + h)); y++) last.fill(spark ? 1 : 0, y * grid.w + left, y * grid.w + right);
  };
  for (const p of paints as Paint[]) {
    if (p.kind === 'fill') {
      const [x = 0, y = 0, w = 0, h = 0] = p.rect;
      paint(x, y, w, h, p.style === colour && w === h && w < grid.h / 4);
    } else if (p.kind === 'sprite') {
      if (p.name.startsWith('kart')) paint(p.x, p.y, KART_W * p.scale, KART_H * p.scale, false);
    } else if (p.at.length === 8) {
      const [, , , , x = 0, y = 0, w = 0, h = 0] = p.at;
      paint(x, y, w, h, false);
    }
  }
  const map = minimapAt(grid, track);
  paint(map.x, map.y, map.w, map.h, false);
  return last.reduce((n, v) => n + v, 0);
}

const frame = (grid: Grid, reduced: boolean): FrameState => ({
  scene: 'kart', grid, page: 0, join: { fleets: [], pick: 0, lockedAt: null, team: null, away: false, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
  view: null, layout: [], sel: 0, fleetSel: 0, t: 3, sceneT: 3, reduced, mark: markFor('Vertuoza', DEFAULT_THEME), theme: DEFAULT_THEME,
});

describe('the player\'s own drift sparks (issue 2057)', () => {
  it.each([['wide', WIDE], ['tall', TALL]] as const)('show on the %s grid, frame after frame, at least as much as the still glow that stands for them with motion reduced', (_name, grid) => {
    // COMET RING's start straight at full speed, a hop into a drift to the left, held on the road until its charge is blue (60 frames a second).
    const kart = createKart({ seed: 5, difficulty: 'easy' });
    kart.press('start');
    const drive = (held: Action[], seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) kart.step(new Set(held), 1 / 60); };
    drive([], 3.1);
    drive(['a'], 1.5);
    drive(['a', 'right'], 0.1);
    drive(['a'], 0.2);
    drive(['a', 'up', 'left'], 20 / 60);
    let blue = false;
    const shown: number[] = [], glow: number[] = [];
    for (let i = 0; i < 120; i++) {
      kart.step(new Set<Action>(['a', 'up', 'right']), 1 / 60);
      blue ||= kart.cues().some((c) => c.kind === 'tick' && c.color === 'blue');
      if (!blue) continue;
      if (kart.skid() <= 0 || kart.speed() < 0.9) break;
      paints.length = 0;
      kart.draw(canvas(), frame(grid, false));
      shown.push(shownOf(grid, DEFAULT_THEME.cyan));
      paints.length = 0;
      kart.draw(canvas(), frame(grid, true));
      glow.push(shownOf(grid, DEFAULT_THEME.cyan));
    }
    // The drift ran at full speed with a blue charge for a while: the sparks were being thrown.
    expect(shown.length).toBeGreaterThanOrEqual(10);
    const sum = (a: readonly number[]) => a.reduce((n, v) => n + v, 0);
    expect(sum(glow)).toBeGreaterThan(0);
    expect(sum(shown)).toBeGreaterThanOrEqual(sum(glow));
  });
});
