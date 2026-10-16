import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../theme';
import { sure } from '../test/sure';
import { FLAKES, flakesOf, isSnow, lakeTiles, mix, peakAt, SNOW, SNOW_KINDS, snowProp, snowScenery, snowSky, snowfall, woodArchLeg } from './art.snow';
import { createKart, minimapTiles } from './art';
import type { FrameState } from '../scenes/common.ts';
import { viewOf } from './mode7';
import { reliefRange } from './relief';
import { FROST_EIGHT, parseTrack, surfaceAt, TILE } from './track';

// The designs' sprites need a real canvas: stubbed out here, as art.test.ts does.
vi.mock('@omni/design', async (original) => {
  const m = await original<typeof import('@omni/design')>();
  return { ...m, drawStarfield: () => {}, spriteImage: () => ({ width: 32, height: 48 }), drawSprite: () => {} };
});

// FROST EIGHT's look (PRD 1923): its sky, flakes, scenery, arch and minimap, drawn under a canvas that only records what it is asked to fill.
function recorder() {
  const fills: { style: string; rect: number[] }[] = [];
  const colours = new Set<string>();
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'fillRect') return (...rect: number[]) => { fills.push({ style: String(state['fillStyle']), rect }); };
      return () => {};
    },
    set(target, prop, value) {
      if (prop === 'fillStyle' && typeof value === 'string') colours.add(value);
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, colours };
}

const view = viewOf({ w: 640, h: 360 }, { x: 500, y: 1000, angle: -Math.PI / 2 });
const track = parseTrack(FROST_EIGHT);

describe('SNOW', () => {
  it('has no colour equal to a theme token (ADR-0046)', () => {
    const tokens = new Set(Object.values(TOKENS).map((c) => c.toLowerCase()));
    for (const [name, colour] of Object.entries(SNOW)) expect(tokens.has(colour.toLowerCase()), name).toBe(false);
  });

  it('mixes two colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#102030', 0.3)).toBe('#102030');
  });
});

describe('isSnow', () => {
  it('is true for FROST EIGHT and false for COMET RING', () => {
    expect(isSnow(track)).toBe(true);
    expect(isSnow(parseTrack())).toBe(false);
  });
});

describe('the sky', () => {
  it('draws a pale blue fading to white, snowy peaks, a low sun and powder under the horizon', () => {
    const { ctx, colours, fills } = recorder();
    snowSky(ctx, view, 0, 7);
    for (const c of [SNOW.skyTop, SNOW.skyLow, SNOW.ground, SNOW.sun, SNOW.peakFar, SNOW.peakNear, SNOW.cap]) expect(colours.has(c), c).toBe(true);
    // Nothing is drawn under the horizon but the powder, and nothing is above the screen.
    expect(fills.filter((f) => f.style === SNOW.ground).every((f) => sure(f.rect[1], 'top') >= 120)).toBe(true);
  });

  it('turns with the camera', () => {
    const a = recorder(), b = recorder();
    snowSky(a.ctx, view, 0, 7);
    snowSky(b.ctx, view, 400, 7);
    expect(b.fills).not.toEqual(a.fills);
  });

  it('has peaks whose ridge ends where it began, between 0 and 1', () => {
    const period = 640 * 6;
    for (const layer of [0, 1] as const) {
      expect(peakAt(7, layer, 0, period)).toBeCloseTo(peakAt(7, layer, period, period), 6);
      for (const u of [0, 100, 777, 2500]) { const h = peakAt(7, layer, u, period); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThanOrEqual(1); }
    }
  });
});

describe('the flakes', () => {
  it('fall: the same seed gives the same flakes, and a later time gives others', () => {
    expect(flakesOf(3, 2, 640, 360, false)).toEqual(flakesOf(3, 2, 640, 360, false));
    expect(flakesOf(3, 2, 640, 360, false)).toHaveLength(FLAKES);
    expect(flakesOf(3, 4, 640, 360, false)).not.toEqual(flakesOf(3, 2, 640, 360, false));
  });

  it('stand still under reduced motion, whatever the time', () => {
    expect(flakesOf(3, 9, 640, 360, true)).toEqual(flakesOf(3, 1, 640, 360, true));
  });

  it('stay on the screen, and are drawn white', () => {
    for (const f of flakesOf(3, 5.5, 640, 360, false)) { expect(f.x).toBeGreaterThanOrEqual(0); expect(f.x).toBeLessThan(640); expect(f.y).toBeGreaterThanOrEqual(0); expect(f.y).toBeLessThan(360); }
    const { ctx, fills } = recorder();
    snowfall(ctx, { t: 1, reduced: false }, view, 3);
    expect(fills).toHaveLength(FLAKES);
    expect(fills.every((f) => f.style === SNOW.flake)).toBe(true);
  });

  it('are the same two drawings when motion is reduced', () => {
    const a = recorder(), b = recorder();
    snowfall(a.ctx, { t: 1, reduced: true }, view, 3);
    snowfall(b.ctx, { t: 8, reduced: true }, view, 3);
    expect(b.fills).toEqual(a.fills);
  });
});

describe('the scenery', () => {
  const { props, stands } = snowScenery(track);

  it('stands pines, chalets, lift pylons, snowmen and signs, and five stands', () => {
    for (const kind of SNOW_KINDS) expect(props.some((p) => p.kind === kind), kind).toBe(true);
    expect(stands).toHaveLength(5);
  });

  it('is decided once and the same for the circuit', () => {
    expect(snowScenery(track)).toBe(snowScenery(track));
  });

  it('stands on powder only: never on the road, the lake or within a tile of them, nor off the map', () => {
    for (const { x, y } of [...props, ...stands]) {
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(track.size.w); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(track.size.h);
      for (const [dx, dy] of [[0, 0], [TILE, 0], [-TILE, 0], [0, TILE], [0, -TILE]] as const) expect(surfaceAt(track, x + dx, y + dy), `${x},${y}`).toBe('powder');
    }
  });

  it('puts the stands beside the start straight, inside the bottom loop', () => {
    for (const s of stands) { expect(s.y / TILE).toBeGreaterThan(50); expect(s.y / TILE).toBeLessThan(61); }
  });

  it.each(SNOW_KINDS)('draws a %s in its own colours, bigger the nearer it is, and not at all when it is a speck', (kind) => {
    const near = recorder(), far = recorder(), speck = recorder();
    snowProp(near.ctx, { sx: 100, sy: 200, z: 20, scale: 2 }, kind);
    snowProp(far.ctx, { sx: 100, sy: 200, z: 80, scale: 0.5 }, kind);
    snowProp(speck.ctx, { sx: 100, sy: 200, z: 900, scale: 0.01 }, kind);
    expect(near.fills.length).toBeGreaterThan(0);
    expect(near.colours.size).toBeGreaterThan(1);
    const height = (r: ReturnType<typeof recorder>) => Math.max(...r.fills.map((f) => 200 - sure(f.rect[1], 'top')));
    expect(height(near)).toBeGreaterThan(height(far));
    expect(speck.fills).toHaveLength(0);
  });
});

describe('the wooden arch', () => {
  it('stands a wooden leg, and its first leg lays the red and white banner across the road', () => {
    const first = recorder(), second = recorder();
    woodArchLeg(first.ctx, view, track, 0, { sx: 200, sy: 220, z: 30, scale: 1.5 });
    woodArchLeg(second.ctx, view, track, 1, { sx: 440, sy: 220, z: 30, scale: 1.5 });
    expect(first.colours.has(SNOW.wood)).toBe(true);
    expect(second.colours.has(SNOW.wood)).toBe(true);
    expect(second.colours.has(SNOW.banner)).toBe(false);
  });
});

describe('the minimap', () => {
  const range = reliefRange(track);
  const tiles = minimapTiles(track, range);

  it('draws the lake in light blue, a disc of 12 tiles across on the crossing', () => {
    const lake = lakeTiles(track);
    expect(lake.length).toBeGreaterThan(100);
    const discs = [[36, 36, 6.8], [16, 8, 3.8], [16, 64, 3.8]] as const;
    for (const t of lake) { expect(discs.some(([cx, cy, r]) => Math.hypot(t.x - cx, t.y - cy) <= r)).toBe(true); expect([SNOW.lake, SNOW.lakeRoad]).toContain(t.colour); }
    const lit = tiles.filter((t) => t.colour === SNOW.lake || t.colour === SNOW.lakeRoad);
    expect(lit).toHaveLength(lake.length);
    expect(tiles.some((t) => t.x === 36 && t.y === 36 && t.colour === SNOW.lakeRoad)).toBe(true);
  });

  it('draws the two frozen patches on bend 4 and bend 8 in light blue as well', () => {
    for (const [x, y] of [[16, 8], [16, 64]] as const) expect(lakeTiles(track).some((t) => t.x === x && t.y === y)).toBe(true);
    expect(lakeTiles(track).filter((t) => Math.hypot(t.x - 36, t.y - 36) > 6.8)).not.toHaveLength(0);
  });

  it('draws each tile once, and the road outside the lake as before', () => {
    expect(new Set(tiles.map((t) => `${t.x},${t.y}`)).size).toBe(tiles.length);
    expect(tiles.some((t) => t.x === 40 && t.y === 64 && t.colour !== SNOW.lake)).toBe(true);
  });

  it('has no lake on COMET RING', () => {
    expect(lakeTiles(parseTrack())).toEqual([]);
  });
});

describe('a race on FROST EIGHT drawn', () => {
  beforeEach(() => {
    class FakeImageData {
      readonly data: Uint8ClampedArray;
      readonly width: number;
      readonly height: number;
      constructor(width: number, height: number) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); }
    }
    vi.stubGlobal('ImageData', FakeImageData);
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData: () => {} }) }) });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const frameOf = (t: number, reduced: boolean) => ({ scene: 'kart', grid: { w: 640, h: 360 }, t, sceneT: t, reduced, join: { fleets: [], pick: 0, lockedAt: null, team: null, away: false, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } }, theme: { void: '#000000', cyan: '#19e6ff', 'plasma-dark': '#222222' } }) as unknown as FrameState;

  it('paints the snowy sky, the scenery and the flakes, and COMET RING\'s space sky is not drawn', () => {
    const { ctx, colours } = recorder();
    createKart({ seed: 1, track }).draw(ctx, frameOf(3, false));
    for (const c of [SNOW.skyTop, SNOW.cap, SNOW.flake, SNOW.lake]) expect(colours.has(c), c).toBe(true);
    expect(colours.has('#0a0824')).toBe(false);
  });

  it('draws the same picture twice over when motion is reduced, flakes and all', () => {
    const a = recorder(), b = recorder();
    createKart({ seed: 1, track }).draw(a.ctx, frameOf(1, true));
    createKart({ seed: 1, track }).draw(b.ctx, frameOf(9, true));
    expect(b.fills).toEqual(a.fills);
  });
});
