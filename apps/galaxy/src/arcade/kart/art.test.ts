import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, resolveTheme, TOKENS, type Theme, type Token } from '../theme';
import { markFor } from '../mark';
import { TALL, WIDE, type FrameState, type Grid } from '../scenes/common.ts';
import { sure } from '../test/sure';
import { createKart } from './art';
import { horizonOf } from './mode7';

// The ready screen's drawing, under a canvas that only counts (PRD 1359): the sky above the horizon in
// the theme's colours, then the floor from one reused pixel buffer, on both grids. The planets and
// nebulae of @omni/design are its own, and stubbed out here.
const planets = vi.hoisted(() => [] as { cy: number; r: number }[]);
vi.mock('@omni/design', async (original) => {
  const m = await original<typeof import('@omni/design')>();
  return {
    ...m,
    drawPlanet: (_ctx: unknown, o: { cy: number; r: number }) => { planets.push({ cy: o.cy, r: o.r }); },
    drawStarfield: () => {},
    makeNebula: () => ({}),
  };
});

interface Put { w: number; h: number; pixels: Uint32Array }
const puts: Put[] = [];
const created: { width: number; height: number }[] = [];

class FakeImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); }
}

beforeEach(() => {
  puts.length = 0; created.length = 0; planets.length = 0;
  vi.stubGlobal('ImageData', FakeImageData);
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => ({ putImageData: (image: FakeImageData) => { puts.push({ w: image.width, h: image.height, pixels: new Uint32Array(image.data.buffer.slice(0)) }); } }) };
      created.push(canvas);
      return canvas;
    },
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

function recorder() {
  const fills: { style: string; rect: number[] }[] = [];
  const images: number[][] = [];
  const colours = new Set<string>();
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'fillRect') return (...rect: number[]) => { fills.push({ style: String(state['fillStyle']), rect }); };
      if (prop === 'drawImage') return (_i: unknown, ...at: number[]) => { images.push(at); };
      return () => {};
    },
    set(target, prop, value) {
      if (prop === 'fillStyle' && typeof value === 'string') colours.add(value);
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, images, colours };
}

const frame = (grid: Grid, theme: Theme = DEFAULT_THEME): FrameState => ({
  scene: 'kart', grid, page: 0, join: { fleets: [], pick: 0, lockedAt: null, team: null, away: false, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
  view: null, layout: [], sel: 0, fleetSel: 0, t: 3, sceneT: 3, reduced: false, mark: markFor('Vertuoza', theme), theme,
});

describe('the ready screen\'s drawing', () => {
  it.each([['wide', WIDE], ['tall', TALL]] as const)('draws the sky above the horizon and the floor under it on the %s grid', (_name, grid) => {
    const { ctx, fills, images } = recorder();
    createKart().draw(ctx, frame(grid));
    const horizon = horizonOf(grid.h);
    expect(fills.length).toBeGreaterThan(0);
    // The sky's bands cover the screen's width down to the horizon, and no further.
    const bands = fills.filter((f) => f.rect[2] === grid.w && f.rect[3] !== 0 && (f.rect[1] ?? 0) < horizon - 6);
    expect(bands.length).toBe(4);
    expect(sure(bands[0], 'the first band').rect[1]).toBe(0);
    expect(Math.max(...bands.map((b) => (b.rect[1] ?? 0) + (b.rect[3] ?? 0)))).toBeGreaterThanOrEqual(horizon - 1);
    expect(Math.max(...fills.map((f) => (f.rect[1] ?? 0) + (f.rect[3] ?? 0)))).toBeLessThanOrEqual(horizon);
    // The floor is one buffer the size of the grid, put on a canvas once and drawn at the corner.
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ w: grid.w, h: grid.h });
    expect(images.at(-1)).toEqual([0, 0]);
    // One planet in the sky, standing on the horizon.
    expect(planets).toHaveLength(1);
    expect(sure(planets[0], 'the planet').cy).toBeLessThan(horizon);
  });

  it('puts nothing in the buffer above the horizon, and a floor under it', () => {
    createKart().draw(recorder().ctx, frame(WIDE));
    const { pixels } = sure(puts[0], 'the floor');
    const horizon = horizonOf(WIDE.h);
    for (let row = 0; row <= horizon; row++) expect(pixels.slice(row * WIDE.w, (row + 1) * WIDE.w).every((p) => p === 0), `row ${row}`).toBe(true);
    for (let row = horizon + 1; row < WIDE.h; row++) expect(pixels.slice(row * WIDE.w, (row + 1) * WIDE.w).every((p) => (p >>> 24) === 0xff), `row ${row}`).toBe(true);
  });

  it('draws the floor from the circuit: the road under the player\'s starting place, grass and wall beside it', () => {
    createKart().draw(recorder().ctx, frame(WIDE));
    const { pixels } = sure(puts[0], 'the floor');
    const bottom = pixels.slice((WIDE.h - 1) * WIDE.w, WIDE.h * WIDE.w);
    expect(new Set(bottom).size).toBeGreaterThan(3);
    const centre = sure(bottom[WIDE.w / 2], 'the centre pixel');
    expect(centre >>> 24).toBe(0xff);
  });

  it('allocates its pixel buffer once per grid and reuses it across frames', () => {
    const kart = createKart();
    const { ctx } = recorder();
    kart.draw(ctx, frame(WIDE));
    kart.draw(ctx, frame(WIDE));
    expect(created).toHaveLength(1);
    kart.draw(ctx, frame(TALL));
    expect(created).toHaveLength(2);
  });

  it('paints the sky in the theme: its void, and its plasma at the horizon', () => {
    const every: Theme = resolveTheme(Object.fromEntries((Object.keys(TOKENS) as Token[]).map((t, i) => [t, `#1000${i.toString(16).padStart(2, '0')}`])));
    const { ctx, colours } = recorder();
    createKart().draw(ctx, frame(WIDE, every));
    expect(colours.has(every.void)).toBe(true);
    expect(colours.has(every['plasma-dark'])).toBe(true);
    expect(colours.has(TOKENS.void)).toBe(false);
    expect(colours.has(TOKENS['plasma-dark'])).toBe(false);
  });

  it('holds the sky still when motion is reduced', () => {
    const a = recorder(), b = recorder();
    createKart().draw(a.ctx, { ...frame(WIDE), reduced: true, t: 1 });
    createKart().draw(b.ctx, { ...frame(WIDE), reduced: true, t: 9 });
    expect(a.images).toEqual(b.images);
  });
});
