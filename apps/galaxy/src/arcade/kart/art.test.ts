import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, resolveTheme, TOKENS, type Theme, type Token } from '../theme';
import { markFor } from '../mark';
import { TALL, WIDE, type FrameState, type Grid } from '../scenes/common.ts';
import { sure } from '../test/sure';
import { kartTint, COLORS } from './look';
import { BELT_ROCKS, BOX_WORLD, CONVOYS, CONVOY_SHIPS, STAND_LIFT, beltRocks, convoyShips, standBob, standLooks, dotColour, boxFrame, minimapAt, minimapLit, minimapTiles, MINIMAP_TOP, poolAlpha, POOL_WORLD, cameraFor, cometsOf, coverOf, createKart, fallenOf, hiddenBlink, KART_WORLD, propFrame, rollOf, SHADOW, viewFacing, viewFor } from './art';
import { RULES } from './rules';
import type { Action } from '../keys';
import { horizonOf, project, viewOf } from './mode7';
import { newRace } from './race';
import { groundAt } from './relief';
import { COMET_RING, TILE, parseTrack, roadAt, type TrackSource } from './track';
import { setFleets } from '../fleets';
import type { FleetRow } from '../types';

// The ready screen's drawing, under a canvas that only counts (PRD 1359): the space the circuit floats in,
// above the horizon and under it, in the theme's colours, then the floor from one reused pixel buffer, on both grids. The planets and
// nebulae of @omni/design are its own, and stubbed out here.
const terrain = vi.hoisted(() => [] as { roofed: Uint8Array | undefined }[]);
const planets = vi.hoisted(() => [] as { cy: number; r: number }[]);
const sprites = vi.hoisted(() => [] as { name: string; x: number; y: number; scale: number | undefined; tint: unknown; frame: number | undefined; clipped: boolean }[]);
vi.mock('./mode7', async (original) => {
  const m = await original<typeof import('./mode7')>();
  return { ...m, renderTerrain: (...a: Parameters<typeof m.renderTerrain>) => { terrain.push({ roofed: a[7] }); return m.renderTerrain(...a); } };
});
vi.mock('@omni/design', async (original) => {
  const m = await original<typeof import('@omni/design')>();
  return {
    ...m,
    drawPlanet: (_ctx: unknown, o: { cy: number; r: number }) => { planets.push({ cy: o.cy, r: o.r }); },
    drawStarfield: () => {},
    makeNebula: () => ({}),
    spriteImage: () => ({ width: 32, height: 48 }),
    drawSprite: (ctx: { clipped?: boolean }, name: string, x: number, y: number, o: { scale?: number; tint?: unknown; frame?: number } = {}) => { sprites.push({ name, x, y, scale: o.scale, tint: o.tint, frame: o.frame, clipped: ctx.clipped === true }); },
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
  puts.length = 0; created.length = 0; terrain.length = 0; planets.length = 0; sprites.length = 0;
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
  /** The angles the canvas was rotated by, in order. */
  const rotations: number[] = [];
  /** Everything drawn, in order: the fills by their colour, the images and the sprites by name. */
  const order: string[] = [];
  const colours = new Set<string>();
  const state: Record<string | symbol, unknown> = {};
  const stack: boolean[] = [];
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'fillRect') return (...rect: number[]) => { fills.push({ style: String(state['fillStyle']), rect }); order.push(`fill ${String(state['fillStyle'])}`); };
      if (prop === 'save') return () => { stack.push(state['clipped'] === true); };
      if (prop === 'restore') return () => { state['clipped'] = stack.pop() ?? false; };
      if (prop === 'clip') return () => { state['clipped'] = true; };
      if (prop === 'rotate') return (angle: number) => { rotations.push(angle); };
      if (prop === 'drawImage') return (_i: unknown, ...at: number[]) => { images.push(at); order.push('image'); };
      return () => {};
    },
    set(target, prop, value) {
      if (prop === 'fillStyle' && typeof value === 'string') colours.add(value);
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, images, colours, order, rotations };
}

const frame = (grid: Grid, theme: Theme = DEFAULT_THEME): FrameState => ({
  scene: 'kart', grid, page: 0, join: { fleets: [], pick: 0, lockedAt: null, team: null, away: false, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
  view: null, layout: [], sel: 0, fleetSel: 0, t: 3, sceneT: 3, reduced: false, mark: markFor('Vertuoza', theme), theme,
});

describe('the race\'s drawing', () => {
  it.each([['wide', WIDE], ['tall', TALL]] as const)('draws space all round, above the horizon and under it, then the floor over it on the %s grid', (_name, grid) => {
    const { ctx, fills, images } = recorder();
    createKart().draw(ctx, frame(grid));
    const horizon = horizonOf(grid.h);
    expect(fills.length).toBeGreaterThan(0);
    // Four bands cover the screen's width from the top down to the horizon, and four more from it to the bottom.
    // (the glow on the horizon is rows one pixel high; the item boxes on the floor are narrower than the screen)
    const bands = fills.filter((f) => f.rect[2] === grid.w && (f.rect[3] ?? 0) > 1);
    const above = bands.filter((b) => (b.rect[1] ?? 0) < horizon), under = bands.filter((b) => (b.rect[1] ?? 0) >= horizon);
    const bottom = (b: { rect: number[] }) => (b.rect[1] ?? 0) + (b.rect[3] ?? 0);
    expect([above.length, under.length]).toEqual([4, 4]);
    expect(sure(above[0], 'the first band').rect[1]).toBe(0);
    expect(Math.max(...above.map(bottom))).toBe(horizon);
    expect(sure(under[0], 'the band under the horizon').rect[1]).toBe(horizon);
    expect(Math.max(...under.map(bottom))).toBeGreaterThanOrEqual(grid.h);
    // The floor is one buffer the size of the grid, put on a canvas once and drawn at the corner, over the space.
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ w: grid.w, h: grid.h });
    expect(images.filter((i) => i.length === 2).at(-1)).toEqual([0, 0]);
    // The big planet stands across the horizon, not cut by it (and a second, smaller one: see 'the sky').
    expect(planets).toHaveLength(3);
    const big = sure(planets[1], 'the planet');
    expect(big.cy).toBeLessThan(horizon);
    expect(big.cy + big.r).toBeGreaterThan(horizon);
  });

  it('puts nothing in the buffer above the horizon, and under it a floor that is see-through over the void', () => {
    createKart().draw(recorder().ctx, frame(WIDE));
    const { pixels } = sure(puts[0], 'the floor');
    const horizon = horizonOf(WIDE.h);
    for (let row = 0; row <= horizon; row++) expect(pixels.slice(row * WIDE.w, (row + 1) * WIDE.w).every((p) => p === 0), `row ${row}`).toBe(true);
    const under = pixels.slice((horizon + 1) * WIDE.w);
    // see-through over the void, opaque on the road and the deck's side, and the deck's glow under its edge: at most half opaque
    expect(under.every((p) => p >>> 24 === 0 || p >>> 24 === 0xff || p >>> 24 <= 0x80)).toBe(true);
    expect(under.some((p) => p >>> 24 === 0xff)).toBe(true); // the road
    expect(under.some((p) => p >>> 24 === 0)).toBe(true); // the void, where the space shows
  });

  it.each([['wide', WIDE], ['tall', TALL]] as const)('draws the player\'s kart where it stands, its wheels on the floor under its centre, as a rival is, on the %s grid', (_name, grid) => {
    const game = createKart({ seed: 5 });
    game.draw(recorder().ctx, frame(grid));
    const kart = sure(sprites.find((x) => x.name.startsWith('kart')), 'the kart');
    const start = newRace({ seed: 5, track: parseTrack() }).player;
    const at = sure(project(viewOf(grid, cameraFor(grid, start)), start.x, start.y), 'the kart on the screen');
    expect(kart.y + 18 * (kart.scale ?? 0)).toBeCloseTo(at.sy, 6);
    expect(kart.x + (28 * (kart.scale ?? 0)) / 2).toBeCloseTo(at.sx, 0);
    // On the wide grid it is about as wide as a rival standing there, KART_WORLD, within a twentieth.
    if (grid === WIDE) expect(Math.abs(28 * (kart.scale ?? 0) - KART_WORLD * at.scale)).toBeLessThan((KART_WORLD * at.scale) / 20);
  });

  it('draws the floor from the circuit: the road under the player\'s starting place, void beside it', () => {
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

describe('the player\'s kart', () => {
  /** The player's kart among what the frame drew: the props and the arch are sprites too. */
  const playerSprite = () => sure(sprites.find((x) => x.name.startsWith('kart')), 'the kart');
  const held = (...a: Action[]): ReadonlySet<Action> => new Set(a);
  /** A game raced for `seconds` of 50 ms frames, after START and the countdown. */
  function raced(seconds: number, ...buttons: Action[]) {
    const kart = createKart({ seed: 5 });
    kart.press('start');
    for (let t = 0; t < 3.1; t += 0.05) kart.step(held(), 0.05);
    for (let t = 0; t < seconds; t += 0.05) kart.step(held(...buttons), 0.05);
    return kart;
  }
  const floorOf = (kart: ReturnType<typeof createKart>, grid: Grid = WIDE) => { puts.length = 0; kart.draw(recorder().ctx, frame(grid)); return sure(puts[0], 'the floor').pixels; };

  it.each([['wide', WIDE, 4], ['tall', TALL, 2]] as const)('is drawn from behind at the bottom of the %s grid, at a whole number of pixels', (_n, grid, scale) => {
    createKart().draw(recorder().ctx, frame(grid));
    const kart = playerSprite();
    expect(kart).toMatchObject({ name: 'kart', scale });
    expect(sure(kart, 'the kart').x).toBe((grid.w - 28 * scale) / 2);
    expect(sure(kart, 'the kart').y + 18 * scale).toBeLessThan(grid.h);
    expect(sure(kart, 'the kart').y + 18 * scale).toBeGreaterThan(grid.h - 12);
  });

  it('is drawn 4 pixels up through a hop, and back on the ground once it has landed (PRD 1963)', () => {
    const seen = (seconds: number, ...b: Action[]) => { sprites.length = 0; raced(seconds, ...b).draw(recorder().ctx, frame(WIDE)); return playerSprite().y; };
    const ground = seen(0);
    expect(ground - seen(0.1, 'up')).toBe(4);
    expect(seen(0.4, 'up')).toBe(ground);
  });

  it('is tinted with the hero\'s suit, the look the arcade draws the hero with', () => {
    createKart().draw(recorder().ctx, frame(WIDE));
    const kart = playerSprite();
    expect(sure(kart, 'the kart').tint).toBeTruthy();
    expect(sure(kart, 'the kart').tint).toHaveProperty('Y');
  });

  it('wears the look the player chose: its design in the three views and its colour on the body', () => {
    createKart({ seed: 1, look: { color: 'PINK', design: 'ROCKET' } }).draw(recorder().ctx, frame(WIDE));
    const kart = playerSprite();
    expect(kart.name).toBe('kart-rocket');
    const plain = (() => { sprites.length = 0; createKart().draw(recorder().ctx, frame(WIDE)); return playerSprite().tint; })();
    expect(JSON.stringify(kart.tint)).not.toBe(JSON.stringify(plain));
    expect(JSON.stringify(kart.tint)).toBe(JSON.stringify(kartTint({ color: 'PINK', design: 'ROCKET' }, sure(plain, 'the fleet tint') as Parameters<typeof kartTint>[1])));
  });

  it('keeps today\'s kart for FLEET and CLASSIC, and for a race made without a look', () => {
    createKart({ seed: 1, look: { color: 'FLEET', design: 'CLASSIC' } }).draw(recorder().ctx, frame(WIDE));
    const withLook = playerSprite();
    sprites.length = 0;
    createKart().draw(recorder().ctx, frame(WIDE));
    expect(withLook.name).toBe('kart');
    expect(JSON.stringify(withLook.tint)).toBe(JSON.stringify(playerSprite().tint));
  });

  it('shows the hero in its seat: head and shoulders, drawn before the kart so the kart covers the rest', () => {
    const { ctx, images } = recorder();
    createKart().draw(ctx, frame(WIDE));
    const driver = images.filter((i) => i.length === 8).at(-1); // the rivals' drivers come first, the player's last
    expect(driver).toBeDefined();
    const [sx, sy, sw, sh, dx, dy, dw, dh] = sure(driver, 'the driver');
    expect([sx, sy, sw, sh]).toEqual([0, 0, 32, 26]);
    expect([dw, dh]).toEqual([64, 52]);
    const kart = playerSprite();
    expect(sure(dx, 'dx')).toBeGreaterThan(kart.x);
    expect(sure(dx, 'dx') + sure(dw, 'width')).toBeLessThan(kart.x + 28 * 4);
    expect(sure(dy, 'dy') + sure(dh, 'dh')).toBeLessThanOrEqual(kart.y + 10 * 4);
  });

  it('leans into the turn: left, straight, right', () => {
    const lean = (...b: Action[]) => { sprites.length = 0; raced(0.5, ...b).draw(recorder().ctx, frame(WIDE)); return playerSprite().name; };
    expect(lean('a')).toBe('kart');
    expect(lean('a', 'left')).toBe('kart-left');
    expect(lean('a', 'right')).toBe('kart-right');
  });

  it('turns its tread with the speed, and holds still at rest or when motion is reduced', () => {
    const frameOf = (kart: ReturnType<typeof createKart>, reduced = false) => { sprites.length = 0; kart.draw(recorder().ctx, { ...frame(WIDE), reduced }); return playerSprite().frame; };
    expect(frameOf(createKart())).toBe(0);
    expect(new Set([0, 1, 2, 3, 4, 5].map((n) => frameOf(raced(0.5 + n * 0.1, 'a')))).size).toBe(2);
    expect(frameOf(raced(1, 'a'), true)).toBe(0);
  });

  it('turns the floor with it: the camera follows behind the kart', () => {
    const straight = floorOf(raced(1, 'a'));
    const turned = floorOf(raced(1, 'a', 'right'));
    expect(turned).not.toEqual(straight);
    expect(floorOf(raced(1, 'a'))).toEqual(straight);
  });

  it('draws what the race holds: nothing moves on the floor before GO and during the pause', () => {
    const kart = createKart({ seed: 5 });
    const before = floorOf(kart);
    kart.press('start');
    kart.step(held('a'), 0.05);
    expect(floorOf(kart)).toEqual(before);
    const racing = raced(1, 'a');
    racing.press('start');
    const paused = floorOf(racing);
    racing.step(held('a'), 0.05);
    expect(floorOf(racing)).toEqual(paused);
  });
});

describe('the game the arcade drives', () => {
  const held = (...a: Action[]): ReadonlySet<Action> => new Set(a);

  it('reads its text layer from the race: ready, the countdown, GO, the pause and back', () => {
    const kart = createKart();
    expect(kart.hud()).toEqual({ phase: 'ready', beat: null });
    expect(kart.press('start')).toEqual({ quit: false, again: false });
    expect(kart.hud()).toEqual({ phase: 'countdown', beat: '3' });
    kart.step(held(), 1.05 / 21);
    for (let t = 0; t < 3; t += 0.05) kart.step(held(), 0.05);
    expect(kart.hud().phase).toBe('race');
    kart.press('start');
    expect(kart.hud().phase).toBe('paused');
    expect(kart.press('select')).toEqual({ quit: true, again: false });
    kart.press('start');
    expect(kart.hud().phase).toBe('race');
  });

  it('pauses from outside, in the countdown and in the race', () => {
    const kart = createKart();
    kart.pause();
    expect(kart.hud().phase).toBe('ready');
    kart.press('start');
    kart.pause();
    expect(kart.hud().phase).toBe('paused');
  });

  it('starts from the seed it is given: the same seed and inputs give the same drawing', () => {
    const a = createKart({ seed: 9 }), b = createKart({ seed: 9 });
    for (const k of [a, b]) { k.press('start'); for (let i = 0; i < 100; i++) k.step(held('a', i < 50 ? 'left' : 'right'), 0.05); }
    puts.length = 0;
    a.draw(recorder().ctx, frame(WIDE)); b.draw(recorder().ctx, frame(WIDE));
    expect(sure(puts[0], 'a').pixels).toEqual(sure(puts[1], 'b').pixels);
  });
});

describe('the rivals on the floor', () => {
  const held = (...a: Action[]): ReadonlySet<Action> => new Set(a);
  /** The images the frame puts on the canvas: five-number calls are a rival's kart, eight-number ones a driver in a seat. */
  const drawn = (kart: ReturnType<typeof createKart>) => { const { ctx, images } = recorder(); kart.draw(ctx, frame(WIDE)); return images; };

  it('draws the rivals standing ahead of the player on the grid: a kart and its driver each, scaled by the distance', () => {
    const images = drawn(createKart({ seed: 3 }));
    const bodies = images.filter((i) => i.length === 4);
    const drivers = images.filter((i) => i.length === 8);
    expect(bodies.length).toBeGreaterThan(0);
    expect(drivers.length).toBe(bodies.length + 1); // and the player's
    for (const [, , w, h] of bodies) expect((w ?? 0) / (h ?? 1)).toBeCloseTo(28 / 18, 5);
  });

  it('draws the farthest rival first and the nearest last, so the near ones cover the far ones', () => {
    const widths = drawn(createKart({ seed: 3 })).filter((i) => i.length === 4).map((i) => i[2] ?? 0);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
  });

  it('draws them from where the race put them: the rivals move away from the player\'s view once the race runs', () => {
    const kart = createKart({ seed: 3 });
    const before = drawn(kart);
    kart.press('start');
    for (let t = 0; t < 8; t += 0.05) kart.step(held(), 0.05);
    expect(drawn(kart)).not.toEqual(before);
  });

  it('draws the same rivals for the same seed, and from the cast it is given', () => {
    expect(drawn(createKart({ seed: 3 }))).toEqual(drawn(createKart({ seed: 3 })));
    const kart = createKart({ seed: 3, cast: [{ sprite: 'shark', tint: null, color: '#123456' }] });
    expect(drawn(kart).filter((i) => i.length === 8).length).toBe(6);
  });
});

describe('the view a rival is seen from', () => {
  it('is the kart from behind when it faces the way the camera looks, and leans left or right as it turns away', () => {
    expect(viewFacing(0, 0)).toBe('kart');
    expect(viewFacing(0.1, 0)).toBe('kart');
    expect(viewFacing(-0.1, 0)).toBe('kart');
    expect(viewFacing(0.8, 0)).toBe('kart-right');
    expect(viewFacing(-0.8, 0)).toBe('kart-left');
  });

  it('measures the angle the short way round', () => {
    expect(viewFacing(Math.PI * 2 - 0.8, 0)).toBe('kart-left');
    expect(viewFacing(0.1, Math.PI * 2)).toBe('kart');
    expect(viewFacing(0.1 + Math.PI * 2, 0)).toBe('kart');
  });
});

describe('the items on the floor (slice 5)', () => {
  it('draws the item boxes as glowing cube sprites, only while they are there', () => {
    const kart = createKart({ seed: 3 });
    kart.press('start');
    const held = new Set<Action>(['a']);
    let seen = 0, empty = 0, most = 0;
    for (let t = 0; t < 12; t += 0.05) {
      kart.step(held, 0.05);
      if (t < 3.1) continue;
      const { ctx } = recorder();
      sprites.length = 0;
      kart.draw(ctx, frame(WIDE));
      const boxes = sprites.filter((x) => x.name === 'item-box').length;
      seen += boxes;
      most = Math.max(most, boxes);
      if (boxes < most) empty++;
    }
    expect(seen).toBeGreaterThan(0);
    expect(empty).toBeGreaterThan(0);
  });

  it('draws a box 20 wide over a pool of its light that pulses with it, and still with reduced motion', () => {
    expect(BOX_WORLD).toBe(20);
    expect(POOL_WORLD).toBeGreaterThan(BOX_WORLD);
    const f = frame(WIDE);
    expect(new Set([0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => poolAlpha({ ...f, t }, 0))).size).toBeGreaterThan(2);
    for (const t of [0, 0.3, 0.9, 2.1]) expect(poolAlpha({ ...f, t, reduced: true }, 40)).toBe(poolAlpha({ ...f, t: 0, reduced: true }, 40));
    const poolAt = (t: number, reduced: boolean) => { const r = recorder(); createKart({ seed: 3 }).draw(r.ctx, { ...f, t, sceneT: t, reduced }); return r.fills.filter((x) => x.style === DEFAULT_THEME.gold); };
    expect(poolAt(1, true).length).toBeGreaterThan(0);
    expect(poolAt(1, true)).toEqual(poolAt(1.37, true));
  });

  it('turns and bobs the boxes, and holds them still when motion is reduced', () => {
    expect(new Set([0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => boxFrame({ ...frame(WIDE), t }, 0))).size).toBe(2);
    for (const t of [0, 0.3, 0.9, 2.1]) expect(boxFrame({ ...frame(WIDE), t, reduced: true }, 40)).toBe(0);
    const boxesAt = (t: number, reduced: boolean) => { sprites.length = 0; createKart({ seed: 3 }).draw(recorder().ctx, { ...frame(WIDE), t, sceneT: t, reduced }); return sprites.filter((x) => x.name === 'item-box'); };
    expect(boxesAt(1, true).length).toBeGreaterThan(0);
    expect(boxesAt(1, true)).toEqual(boxesAt(1.37, true));
    expect(boxesAt(1, false)).not.toEqual(boxesAt(1.37, false));
  });

  it('flashes where a box was taken, and leaves its place empty until it comes back', () => {
    const kart = createKart({ seed: 3 });
    kart.press('start');
    for (let t = 0; t < 3.1; t += 0.05) kart.step(new Set<Action>(), 0.05);
    const count = () => { sprites.length = 0; kart.draw(recorder().ctx, frame(WIDE)); return sprites.filter((x) => x.name === 'item-box').length; };
    const before = count();
    let flashed = false;
    for (let t = 0; t < 12 && !flashed; t += 0.05) {
      kart.step(new Set<Action>(['a']), 0.05);
      if (kart.hud().run?.item) {
        const r = recorder();
        kart.draw(r.ctx, frame(WIDE));
        flashed = r.fills.some((f) => f.style === DEFAULT_THEME.white && (f.rect[2] ?? 0) < 12);
      }
    }
    expect(flashed).toBe(true);
    expect(before).toBeGreaterThan(0);
  });
  it('shows no item before one is taken, and draws on both grids', () => {
    const kart = createKart({ seed: 3 });
    kart.press('start');
    for (let t = 0; t < 3.1; t += 0.05) kart.step(new Set<Action>(), 0.05);
    const { ctx } = recorder();
    kart.press('b');
    expect(kart.hud().run?.item).toBeNull();
    expect(() => { kart.draw(ctx, frame(WIDE)); }).not.toThrow();
    expect(() => { kart.draw(ctx, frame(TALL)); }).not.toThrow();
  });
});

// Shadows and particles (PRD 1427, slice 7).
describe('the shadows and the effects', () => {
  const shadows = (order: readonly string[]) => order.flatMap((o, i) => (o === `fill ${SHADOW}` ? [i] : []));
  const drawnOrder = (state: FrameState = frame(WIDE)) => { const r = recorder(); createKart({ seed: 3 }).draw(r.ctx, state); return r.order; };

  it('draws every kart\'s shadow on the floor before the kart, the player\'s too', () => {
    const order = drawnOrder();
    const first = shadows(order);
    // Three rows a shadow: the player's and the rivals' in view.
    expect(first.length).toBeGreaterThanOrEqual(6);
    expect(first.length % 3).toBe(0);
    // The player's shadow is the last one, and the kart's images come after it.
    const last = sure(first.at(-1), 'a shadow row');
    expect(order.slice(last + 1).filter((o) => o === 'image').length).toBeGreaterThanOrEqual(1);
    // Each rival's driver and body are drawn after its shadow: no image sits between two shadows of one kart.
    for (let i = 0; i < first.length; i += 3) expect(sure(first[i + 2], 'row') - sure(first[i], 'row')).toBe(2);
  });

  it('keeps the shadows when motion is reduced', () => {
    expect(shadows(drawnOrder({ ...frame(WIDE), reduced: true })).length).toBe(shadows(drawnOrder()).length);
  });

  it('draws no particle when motion is reduced', () => {
    // The flash where a box is taken is the particle a race makes first: white squares on the floor (the stars are 2 by 1).
    const flashes = (kart: ReturnType<typeof createKart>, reduced: boolean) => {
      const r = recorder();
      kart.draw(r.ctx, { ...frame(WIDE), reduced });
      return r.fills.filter((f) => f.style === DEFAULT_THEME.white && f.rect[2] === f.rect[3] && (f.rect[0] ?? 0) < minimapAt(WIDE, parseTrack()).x);
    };
    const kart = createKart({ seed: 3 });
    kart.press('start');
    for (let t = 0; t < 3.1; t += 0.05) kart.step(new Set<Action>(), 0.05);
    for (let t = 0; t < 12 && !kart.hud().run?.item; t += 0.05) kart.step(new Set<Action>(['a']), 0.05);
    expect(flashes(kart, false).length).toBeGreaterThan(0);
    expect(flashes(kart, true)).toHaveLength(0);
  });
});

// The race tells the arcade what happened as cues (PRD 1427, slice 2), and how fast the player goes.
describe('the cues the game gives', () => {
  const NO_KEYS: ReadonlySet<Action> = new Set();
  const frames = (game: ReturnType<typeof createKart>, seconds: number, held: ReadonlySet<Action> = NO_KEYS) => {
    for (let t = 0; t < seconds - 1e-9; t += 0.05) game.step(held, 0.05);
  };

  it('gives beep 3 on START, then beep 2, beep 1 and go, each once, in order, and forgets them once handed over', () => {
    const game = createKart({ seed: 7 });
    expect(game.cues()).toEqual([]);
    game.press('start');
    expect(game.cues()).toEqual([{ kind: 'beep', beat: '3' }]);
    expect(game.cues()).toEqual([]);
    frames(game, 3.5);
    expect(game.cues()).toEqual([{ kind: 'beep', beat: '2' }, { kind: 'beep', beat: '1' }, { kind: 'go' }]);
  });

  it('gives one item cue with its item and you when the player uses one', () => {
    const game = createKart({ seed: 7 });
    game.press('start');
    frames(game, 3.5);
    game.cues();
    // Drive until the player takes a box (it holds an item), then use it.
    for (let i = 0; i < 400 && !game.hud().run?.item; i++) game.step(new Set<Action>(['a']), 0.05);
    const held = game.hud().run?.item;
    const taken = game.cues();
    expect(held).toBeTruthy();
    expect(taken.filter((c) => c.kind === 'box')).toHaveLength(1);
    game.press('b');
    expect(game.cues()).toEqual([{ kind: 'item', item: held, you: true, tiles: 0 }]);
    game.press('b');
    expect(game.cues()).toEqual([]);
  });

  it('gives the player\'s speed as a share of its top speed, 0 at rest and never past 1', () => {
    const game = createKart({ seed: 7 });
    expect(game.speed()).toBe(0);
    game.press('start');
    frames(game, 3.5);
    frames(game, 2, new Set<Action>(['a']));
    expect(game.speed()).toBeGreaterThan(0.3);
    expect(game.speed()).toBeLessThanOrEqual(1);
  });
});

// The props and the arch stand around the circuit as sprites, with the karts (PRD 1427, slice 3).
describe('the props and the arch', () => {
  const at = (t: number, reduced = false): FrameState => ({ ...frame(WIDE), t, sceneT: t, reduced });
  const drawn = (state: FrameState = frame(WIDE)) => { sprites.length = 0; createKart({ seed: 3 }).draw(recorder().ctx, state); return [...sprites]; };
  const named = (list: typeof sprites, prefix: string) => list.filter((x) => x.name.startsWith(prefix));

  it('draws the props in view as sprites, and the arch\'s two legs and its beam', () => {
    const list = drawn();
    expect(named(list, 'prop-').length).toBeGreaterThan(0);
    expect(named(list, 'arch-leg')).toHaveLength(2);
    expect(named(list, 'arch-beam')).toHaveLength(1);
  });

  it('draws them before the player\'s kart, so the kart covers them', () => {
    const list = drawn();
    const last = sure(list.at(-1), 'the last sprite');
    expect(last.name).toBe('kart');
    expect(list.findLastIndex((x) => x.name.startsWith('prop-'))).toBeLessThan(list.length - 1);
  });

  it('draws them far to near, each scaled by its distance', () => {
    const horizon = horizonOf(WIDE.h);
    // On a flat circuit: a prop on raised ground stands higher, which this proportion leaves out.
    sprites.length = 0;
    const zeros = Array.from({ length: COMET_RING.waypoints.length }, () => 0);
    createKart({ seed: 3, track: parseTrack({ ...COMET_RING, relief: { heights: zeros, bumps: zeros } }) }).draw(recorder().ctx, frame(WIDE));
    const pylons = named([...sprites], 'prop-pylon').map((x) => ({ ...x, scale: sure(x.scale, 'a scale') }));
    expect(pylons.length).toBeGreaterThan(1);
    expect(pylons.map((x) => x.scale)).toEqual([...pylons.map((x) => x.scale)].sort((a, b) => a - b));
    // The sprite's foot stands (height × focal) / z under the horizon, and its scale is proportional to 1 / z: their ratio is the same for every pylon.
    const feet = pylons.map((x) => x.y + 28 * x.scale - horizon);
    const products = pylons.flatMap((x, i) => ((feet[i] ?? 0) > 12 ? [x.scale / sure(feet[i], 'a foot')] : []));
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) expect(p / sure(products[0], 'a product')).toBeCloseTo(1, 1);
  });

  it('blinks the beacons and turns the satellites, and holds them still when motion is reduced', () => {
    expect(new Set([0, 0.25, 0.5, 0.75, 1, 1.25].map((t) => propFrame('beacon', at(t)))).size).toBe(2);
    expect(new Set([0, 0.4, 0.8, 1.2, 1.6, 2].map((t) => propFrame('satellite', at(t)))).size).toBe(2);
    for (const t of [0, 0.7, 1.3, 2.9]) for (const kind of ['beacon', 'satellite', 'pylon', 'asteroid', 'wreck'] as const) expect(propFrame(kind, at(t, true))).toBe(0);
    expect(propFrame('pylon', at(0.7))).toBe(0);
    const frames = (t: number, reduced: boolean) => named(drawn(at(t, reduced)), 'prop-beacon').map((x) => x.frame);
    expect(frames(0, true)).toEqual(frames(0.5, true));
    expect(frames(0, false)).not.toEqual(frames(0.5, false));
  });

  it('is the same drawing for the same race: the props are fixed in the circuit', () => {
    expect(drawn()).toEqual(drawn());
  });
});

// The livelier sky: a second planet, a distant station and comets crossing (PRD 1427, slice 6).
describe('the sky', () => {
  const at = (t: number, reduced = false): FrameState => ({ ...frame(WIDE), t, sceneT: t, reduced });
  const horizon = horizonOf(WIDE.h);
  const skyOf = (seed: number, state: FrameState) => {
    planets.length = 0; sprites.length = 0;
    const r = recorder();
    createKart({ seed }).draw(r.ctx, state);
    return { planets: [...planets], station: sprites.filter((x) => x.name === 'sky-station'), fills: r.fills, images: r.images };
  };

  it('draws a second, smaller planet in the sky, beside the first', () => {
    const { planets: list } = skyOf(3, at(3));
    expect(list).toHaveLength(3);
    const [big, small] = [sure(list[1], 'the first planet'), sure(list[2], 'the second planet')];
    expect(small.r).toBeLessThan(big.r);
    expect(small.r).toBeGreaterThan(0);
    expect(small.cy).toBeLessThan(horizon);
  });

  it('draws a distant station above the horizon, one sprite, its lamp blinking', () => {
    const { station } = skyOf(3, at(3));
    expect(station).toHaveLength(1);
    expect(sure(station[0], 'the station').y).toBeLessThan(horizon);
    expect(new Set([0, 0.3, 0.6, 0.9, 1.2].map((t) => sure(skyOf(3, at(t)).station[0], 'the station').frame)).size).toBe(2);
  });

  it('sends comets across now and then, seeded from the race', () => {
    const w = WIDE.w;
    const same = cometsOf(7, 2, w, horizon, false);
    expect(cometsOf(7, 2, w, horizon, false)).toEqual(same);
    const seen = (seed: number) => Array.from({ length: 60 }, (_, i) => cometsOf(seed, i * 0.5, w, horizon, false));
    // Now and then: some moments have a comet crossing, and some have none.
    expect(seen(7).some((c) => c.length > 0)).toBe(true);
    expect(seen(7).some((c) => c.length === 0)).toBe(true);
    expect(seen(7)).not.toEqual(seen(8));
    // A comet stays in the sky and moves as time passes.
    for (const frames of seen(7)) for (const c of frames) { expect(c.y).toBeGreaterThanOrEqual(0); expect(c.y).toBeLessThan(horizon); }
    const times = Array.from({ length: 120 }, (_, i) => i * 0.1);
    const xs = times.map((t) => cometsOf(7, t, w, horizon, false)[0]?.x).filter((x) => x !== undefined);
    expect(new Set(xs).size).toBeGreaterThan(1);
  });

  it('draws the comets in the frame, and they cross as time passes', () => {
    const times = Array.from({ length: 60 }, (_, i) => i * 0.5);
    const drawn = times.map((t) => skyOf(7, at(t)).fills.filter((f) => (f.rect[1] ?? horizon) < horizon && f.rect[2] !== undefined && f.rect[2] < 16 && (f.style === DEFAULT_THEME.white || f.style === DEFAULT_THEME.cyan) && (f.rect[0] ?? 0) < minimapAt(WIDE, parseTrack()).x));
    expect(drawn.some((f) => f.length > 0)).toBe(true);
    expect(drawn.some((f) => f.length === 0)).toBe(true);
  });

  it('stands still when motion is reduced: two frames draw the same sky, comets and station included', () => {
    const a = skyOf(7, at(1, true)), b = skyOf(7, at(9.3, true));
    expect(a).toEqual(b);
    expect(cometsOf(7, 1, WIDE.w, horizon, true)).toEqual(cometsOf(7, 9.3, WIDE.w, horizon, true));
    expect(cometsOf(7, 1, WIDE.w, horizon, true).length).toBeGreaterThan(0);
  });
});

// The fall into the void (PRD 1447, slice 2): the kart falling smaller and lower, and blinking.
describe('the kart falling and blinking', () => {
  it('lets a kart fall only once all of it is past the edge: the overhang is half its width as drawn', () => {
    expect(RULES.overhang).toBe(KART_WORLD / 2);
  });

  it('measures a fall from 0 (just over the edge) to 1 (gone), and blinks every other frame of the blink', () => {
    expect(fallenOf({ fall: 0 })).toBe(0);
    expect(fallenOf({ fall: RULES.fallTime })).toBe(0);
    expect(fallenOf({ fall: RULES.fallTime / 2 })).toBeCloseTo(0.5, 9);
    expect(fallenOf({ fall: 0.0001 })).toBeGreaterThan(0.99);
    expect(hiddenBlink({ blink: 0 })).toBe(false);
    const frames = Array.from({ length: 12 }, (_, i) => hiddenBlink({ blink: RULES.blinkTime - i * 0.02 }));
    expect(frames.some(Boolean)).toBe(true);
    expect(frames.some((h) => !h)).toBe(true);
  });

  /** The player's kart sprite frame by frame as the player drives off the road's edge until it is back: its scale and y, or null when it is not drawn. */
  function series() {
    const game = createKart({ seed: 3 });
    game.press('start');
    for (let t = 0; t < 3.1; t += 0.05) game.step(new Set<Action>(), 0.05);
    const out: ({ scale: number; y: number } | null)[] = [];
    for (let t = 0; t < 20; t += 0.05) {
      game.step(new Set<Action>(['a', 'right']), 0.05);
      sprites.length = 0;
      game.draw(recorder().ctx, frame(WIDE));
      const k = sprites.find((x) => x.name.startsWith('kart'));
      out.push(k ? { scale: k.scale ?? 0, y: k.y } : null);
    }
    return out;
  }

  it('draws a falling kart smaller and lower as its fall goes on, down to nothing, and a blinking one every other frame', () => {
    const s = series();
    const first = s.findIndex((k) => k !== null && k.scale < 4);
    expect(first).toBeGreaterThan(-1);
    const end = s.findIndex((k, i) => i > first && (k === null || k.scale >= 4));
    const run = s.slice(first, end).flatMap((k) => (k ? [k] : []));
    expect(run.length).toBeGreaterThan(3);
    expect(run.every((k) => k.scale < 4)).toBe(true);
    expect(run.map((k) => k.y)).toEqual([...run.map((k) => k.y)].sort((a, b) => a - b));
    expect(run.map((k) => k.scale)).toEqual([...run.map((k) => k.scale)].sort((a, b) => b - a));
    expect(s.slice(end).some((k) => k === null)).toBe(true); // hidden on the blink's off frames
    expect(s.slice(first).some((k) => k !== null && k.scale === 4)).toBe(true); // back at full size on the road
  });
});

describe('the relief on the screen (PRD 1698)', () => {
  const n = COMET_RING.waypoints.length;
  // The start straight runs east from waypoint 13 to waypoint 0, with a hump of 26 at its middle.
  const hump = parseTrack({ ...COMET_RING, relief: { heights: Array.from({ length: n }, () => 0), bumps: Array.from({ length: n }, (_, i) => (i === n - 1 ? 26 : 0)) } });
  const flat = parseTrack({ ...COMET_RING, relief: { heights: Array.from({ length: n }, () => 0), bumps: Array.from({ length: n }, () => 0) } });

  it('puts the camera\'s eye 28 over the ground under the player\'s kart', () => {
    for (const grid of [WIDE, TALL]) {
      const kart = newRace({ seed: 1, track: hump }).player;
      expect(viewFor(grid, hump, kart).height).toBeCloseTo(28 + groundAt(hump, kart.x, kart.y), 9);
      const up = { ...kart, x: 39.5 * 16, y: 62.5 * 16 };
      expect(groundAt(hump, up.x, up.y)).toBeCloseTo(26, 6);
      expect(viewFor(grid, hump, up).height).toBeCloseTo(54, 6);
      expect(viewFor(grid, flat, up).height).toBe(28);
    }
  });

  it('cuts what stands behind a crest from the first row the nearer road covers, and nothing where none does', () => {
    const w = 8, h = 10;
    const depth = new Float32Array(w * h).fill(Infinity);
    // The road 40 away covers the rows from 6 down in columns 2 to 4.
    for (let row = 6; row < h; row++) for (let col = 2; col < 5; col++) depth[row * w + col] = 40;
    const cut = coverOf(depth, w, h, { left: 0, right: 8, top: 0, bottom: 10 }, 100);
    expect(Array.from(cut ?? [])).toEqual([10, 10, 6, 6, 6, 10, 10, 10]);
    expect(coverOf(depth, w, h, { left: 0, right: 8, top: 0, bottom: 10 }, 30)).toBeNull(); // nearer than the road: nothing hides it
    expect(coverOf(depth, w, h, { left: 5, right: 8, top: 0, bottom: 10 }, 100)).toBeNull();
  });

  it('cuts what stands under a nearer roof down to the last row the roof covers, and leaves what the roof does not reach (bug 2146)', () => {
    const w = 6, h = 10;
    const depth = new Float32Array(w * h).fill(Infinity);
    // A tunnel's roof 40 away covers the rows down to 2 in every column, its wall the whole of column 5; the road 40 away covers the rows from 8 down in column 1.
    for (let row = 0; row < 3; row++) for (let col = 0; col < w; col++) depth[row * w + col] = 40;
    for (let row = 0; row < h; row++) depth[row * w + 5] = 40;
    for (let row = 8; row < h; row++) depth[row * w + 1] = 40;
    const box = { left: 0, right: 6, top: 0, bottom: 10 };
    expect(Array.from(coverOf(depth, w, h, box, 100, 'above') ?? [])).toEqual([3, 3, 3, 3, 3, 10]);
    // From below, the roof over a thing hides none of it: only the road in front of its foot and the wall do.
    expect(Array.from(coverOf(depth, w, h, box, 100) ?? [])).toEqual([10, 8, 10, 10, 10, 0]);
    expect(coverOf(depth, w, h, { left: 0, right: 5, top: 3, bottom: 8 }, 100, 'above')).toBeNull();
  });

  it('clips the things behind a hill\'s crest and none on a flat circuit, the arch always on top', () => {
    const clipped = (track: typeof hump) => {
      sprites.length = 0;
      createKart({ seed: 3, track }).draw(recorder().ctx, frame(WIDE));
      return [...sprites];
    };
    const onFlat = clipped(flat), onHill = clipped(hump);
    expect(onFlat.filter((x) => x.clipped).map((x) => [x.name, x.x, x.y])).toEqual([]);
    expect(onHill.filter((x) => x.name.startsWith('arch')).every((x) => !x.clipped)).toBe(true);
    expect(onHill.filter((x) => x.name.startsWith('arch')).length).toBeGreaterThan(0);
    expect(onHill.some((x) => x.clipped)).toBe(true);
  });
});

describe('tipping over the edge on the screen (PRD 1698)', () => {
  it('rolls a kart towards the side over the void, a little for a lean and onto its side as a tipped kart falls', () => {
    expect(rollOf(0, 0)).toBe(0);
    expect(rollOf(0, 1)).toBeGreaterThan(0); // all four wheels out when it falls: onto its right side
    expect(rollOf(0.5, 0)).toBeGreaterThan(0); // one wheel out on its right: clockwise
    expect(rollOf(-0.5, 0)).toBeLessThan(0);
    expect(rollOf(0.5, 0)).toBeCloseTo(-rollOf(-0.5, 0), 9);
    expect(rollOf(0.5, 0)).toBeLessThan(Math.PI / 4);
    expect(rollOf(1, 0.5)).toBeGreaterThan(rollOf(0.5, 0));
    expect(rollOf(1, 1)).toBeGreaterThan(rollOf(1, 0.5));
    expect(rollOf(1, 1)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
  });

  it('leans a kart fully and rocks it while the grace counts, and leans it without rocking when motion is reduced', () => {
    const plain = rollOf(1, 0);
    const warned = (t: number, reduced = false) => rollOf(1, 0, { t, reduced });
    expect(warned(0, true)).toBeGreaterThan(plain); // fully leaned
    expect(warned(0.1, true)).toBe(warned(0.9, true)); // still
    const rocks = new Set([0, 0.03, 0.06, 0.09, 0.12].map((t) => warned(t).toFixed(4)));
    expect(rocks.size).toBeGreaterThan(1);
    expect(rollOf(-1, 0, { t: 0.05, reduced: false })).toBeCloseTo(-warned(0.05), 9);
  });

  /** The player driving off the road's edge, gas and right held, frame by frame until it is back: what each frame rotated the canvas by, and whether the player's shadow was drawn. */
  const STRAIGHT = new Set<Action>(['a']), RIGHT = new Set<Action>(['a', 'right']);
  const handsAt = (t: number) => (t >= 1.5 ? RIGHT : STRAIGHT); // straight on, then right
  function series() {
    const game = createKart({ seed: 3 });
    game.press('start');
    for (let t = 0; t < 3.1; t += 0.05) game.step(new Set<Action>(), 0.05);
    const out: { roll: number; shadow: boolean; falling: boolean }[] = [];
    let seen = false;
    for (let t = 0; t < 20; t += 0.02) {
      game.step(handsAt(t), 0.02);
      sprites.length = 0;
      const r = recorder();
      game.draw(r.ctx, frame(WIDE));
      const k = sprites.find((x) => x.name.startsWith('kart'));
      const falling = k !== undefined && (k.scale ?? 4) < 4;
      seen = seen || falling;
      // The player's shadow stands at the grid's middle, near its bottom.
      const shadow = r.fills.some((f) => { const [x = 0, y = 0, w = 0] = f.rect; return f.style === SHADOW && Math.abs(x + w / 2 - WIDE.w / 2) < 3 && y > WIDE.h - 60; });
      out.push({ roll: Math.max(0, ...r.rotations.map(Math.abs)), shadow, falling });
      if (seen && !falling && k) break;
    }
    return out;
  }

  it('draws a leaning kart rolled and a falling one rolled further, with no shadow while it falls', () => {
    const s = series();
    const leaning = s.filter((f) => !f.falling && f.roll > 0);
    const falling = s.filter((f) => f.falling && f.roll > 0);
    expect(leaning.length).toBeGreaterThan(0);
    expect(falling.length).toBeGreaterThan(3);
    expect(Math.max(...falling.map((f) => f.roll))).toBeGreaterThan(Math.max(...leaning.map((f) => f.roll)));
    // The frame the fall begins on is still full size: it has the roll of a lean and already no shadow.
    expect(leaning.filter((f) => f.shadow).length).toBeGreaterThan(0);
    expect(leaning.filter((f) => !f.shadow).length).toBeLessThanOrEqual(1);
    expect(s.filter((f) => f.falling).some((f) => f.shadow)).toBe(false);
    expect(s.filter((f) => !f.falling && f.roll === 0).some((f) => f.shadow)).toBe(true);
  });
});

describe('a driver\'s look and the minimap dots (PRD 1762)', () => {
  it('takes the dot of a kart from its look\'s colour, and the fleet\'s colour for FLEET or no look', () => {
    expect(dotColour({ color: 'PINK', design: 'CLASSIC' }, '#123456')).toBe(COLORS.find((c) => c.name === 'PINK')?.hex);
    expect(dotColour({ color: 'FLEET', design: 'CLASSIC' }, '#123456')).toBe('#123456');
    expect(dotColour(undefined, '#123456')).toBe('#123456');
  });

  it('draws a rival that carries a look with its colour on the minimap, the others as today, and the player\'s dot stays yellow', () => {
    const r = recorder();
    const cast = [{ sprite: 'shark', tint: null, color: '#123456', look: { color: 'PINK', design: 'RACER' } }, { sprite: 'fox', tint: null, color: '#654321' }];
    createKart({ seed: 3, cast }).draw(r.ctx, frame(WIDE));
    const dots = r.fills.filter((f) => f.rect[2] === 2 && f.rect[3] === 2).map((f) => f.style);
    expect(dots).toContain(COLORS.find((c) => c.name === 'PINK')?.hex);
    expect(dots).toContain('#654321');
    expect(r.fills.some((f) => f.style === DEFAULT_THEME.yellow && f.rect[2] === 3)).toBe(true);
  });
});

describe('the minimap (PRD 1698)', () => {
  const track = parseTrack();
  const inside = (grid: Grid, f: { rect: number[] }) => { const m = minimapAt(grid, track); const [x = 0, y = 0] = f.rect; return x >= m.mapX && y >= m.mapY && x < m.mapX + track.cols && y < m.mapY + track.rows; };

  it.each([['wide', WIDE], ['tall', TALL]] as const)('stands in the top right corner, 8 in from the right edge and under the item panel, one pixel a tile, on the %s grid', (_n, grid) => {
    const m = minimapAt(grid, track);
    expect(m.x + m.w).toBe(grid.w - 8);
    expect(m.y).toBeGreaterThanOrEqual(32);
    expect(m.w).toBe(track.cols + 2);
    expect(m.h).toBe(track.rows + 2);
    const r = recorder();
    createKart({ seed: 1 }).draw(r.ctx, frame(grid));
    expect(r.fills.some((f) => f.style === DEFAULT_THEME.cyan && f.rect.join() === [m.x, m.y, m.w, m.h].join())).toBe(true);
  });

  it('shows the curved circuit: the middle of each arc is on it, the square corner a bend cuts off is not', () => {
    const present = new Set(minimapTiles(track, { low: 0, high: 0 }).map((t) => `${t.x},${t.y}`));
    const wps = COMET_RING.waypoints;
    const n = wps.length;
    const unit = (a: readonly [number, number, number], b: readonly [number, number, number]) => {
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { x: (b[0] - a[0]) / d, y: (b[1] - a[1]) / d };
    };
    for (const i of [1, 2, 3, 7, 8, 10, 11, 12]) {
      const w = sure(wps[i], 'a waypoint');
      const a = unit(w, sure(wps[(i + n - 1) % n], 'the waypoint before')), b = unit(w, sure(wps[(i + 1) % n], 'the waypoint after'));
      const bis = { x: a.x + b.x, y: a.y + b.y };
      const len = Math.hypot(bis.x, bis.y);
      const inward = { x: bis.x / len, y: bis.y / len };
      const r = w[2];
      // The arc's middle lies r·(√2 − 1) from the corner point towards the inside; the square corner of the road lies 2.5·√2 outside.
      const mid = { x: w[0] + 0.5 + inward.x * r * (Math.SQRT2 - 1), y: w[1] + 0.5 + inward.y * r * (Math.SQRT2 - 1) };
      const outer = { x: w[0] + 0.5 - inward.x * 2.5 * Math.SQRT2, y: w[1] + 0.5 - inward.y * 2.5 * Math.SQRT2 };
      expect(present.has(`${Math.floor(mid.x)},${Math.floor(mid.y)}`), `the arc of waypoint ${i}`).toBe(true);
      expect(present.has(`${Math.floor(outer.x)},${Math.floor(outer.y)}`), `the square corner of waypoint ${i}`).toBe(false);
    }
  });

  it('shades the road by its height, lighter the higher, and the start line white', () => {
    const tiles = minimapTiles(track, { low: 0, high: 26 });
    const light = (c: string) => Number(/rgb\((\d+)/.exec(c)?.[1] ?? 0);
    expect(tiles.length).toBeGreaterThan(100);
    const shades = tiles.filter((t) => t.colour !== '#ffffff').map((t) => light(t.colour));
    expect(Math.max(...shades)).toBeGreaterThan(Math.min(...shades));
    expect(tiles.some((t) => t.colour === '#ffffff')).toBe(true);
    const flat = minimapTiles(parseTrack(openSource()), { low: 0, high: 0 });
    expect(new Set(flat.filter((t) => t.colour !== '#ffffff').map((t) => t.colour)).size).toBe(1);
  });

  it('draws a gold pixel per box there to take, a dot per rival and the player\'s yellow dot last', () => {
    const r = recorder();
    createKart({ seed: 1 }).draw(r.ctx, frame(WIDE));
    const gold = r.fills.filter((f) => f.style === DEFAULT_THEME.gold && inside(WIDE, f) && f.rect[2] === 1);
    expect(gold).toHaveLength(track.boxes.length);
    expect(r.fills.filter((f) => inside(WIDE, f) && f.rect[2] === 2 && f.rect[3] === 2)).toHaveLength(5);
    const yellow = r.fills.map((f, i) => ({ f, i })).filter(({ f }) => f.style === DEFAULT_THEME.yellow && inside(WIDE, f) && f.rect[2] === 3);
    expect(yellow).toHaveLength(1);
    const after = r.fills.slice(sure(yellow[0], 'dot').i + 1).filter((f) => inside(WIDE, f));
    expect(after.every((f) => f.rect[2] === 1 && f.rect[3] === 1)).toBe(true);
    expect(after).toHaveLength(1);
  });

  it('blinks the player\'s dot while it falls, and not with reduced motion', () => {
    expect(minimapLit({ t: 0.3, reduced: false }, { fall: 0 })).toBe(true);
    expect(minimapLit({ t: 0, reduced: false }, { fall: 1 })).toBe(true);
    expect(minimapLit({ t: 0.2, reduced: false }, { fall: 1 })).toBe(false);
    expect(minimapLit({ t: 0.2, reduced: true }, { fall: 1 })).toBe(true);
    expect(MINIMAP_TOP).toBeGreaterThanOrEqual(32);
  });
});

describe('a kart in the air on the screen (PRD 1775)', () => {
  it('keeps the camera\'s eye 28 over the kart\'s own height, and a shadow lower on the screen than the kart itself', () => {
    const track = parseTrack();
    for (const grid of [WIDE, TALL]) {
      const kart = newRace({ seed: 1, track }).player;
      const aloft = { ...kart, height: 20, lift: 0 };
      expect(viewFor(grid, track, aloft).height).toBeCloseTo(viewFor(grid, track, kart).height + 20, 9);
      const v = viewFor(grid, track, aloft);
      const shade = project(v, aloft.x, aloft.y, groundAt(track, aloft.x, aloft.y));
      const body = project(v, aloft.x, aloft.y, groundAt(track, aloft.x, aloft.y) + 20);
      expect(shade && body && shade.sy > body.sy).toBe(true);
    }
  });
});

// The livelier decor (PRD 1775, slice 7): the stands, the station's props, the convoys, the belt, the big planet, the tunnel.
describe('the stands', () => {
  const fleetRow = (name: string, mascot: string | null, retired = false): FleetRow => ({ name, home: null, label: name.toUpperCase(), color: '#2fc6a4', motto: '', mascot, sort: 0, retired });
  afterEach(() => { setFleets([]); });
  const at = (t: number, reduced = false): FrameState => ({ ...frame(WIDE), t, sceneT: t, reduced });

  it('show the active fleets in their order, start again from the first when there are fewer fleets than stands, and skip the retired', () => {
    setFleets([fleetRow('beaver', 'beaver'), fleetRow('gone', 'shark', true), fleetRow('shark', 'shark')]);
    expect(standLooks(5).map((l) => l.label)).toEqual(['BEAVER', 'SHARK', 'BEAVER', 'SHARK', 'BEAVER']);
    expect(standLooks(2).map((l) => l.sprite)).toEqual(['beaver', 'shark']);
  });

  it('show the neutral ship with no fleet, or only retired ones', () => {
    expect(standLooks(3).map((l) => l.sprite)).toEqual(['ship', 'ship', 'ship']);
    setFleets([fleetRow('gone', 'shark', true)]);
    expect(standLooks(2).map((l) => l.sprite)).toEqual(['ship', 'ship']);
  });

  it('bob gently over the void, and stand still when motion is reduced', () => {
    const bobs = [0, 0.4, 0.8, 1.2, 1.6].map((t) => standBob({ t, reduced: false }, 0));
    expect(new Set(bobs).size).toBeGreaterThan(1);
    for (const b of bobs) expect(Math.abs(b)).toBeLessThanOrEqual(2);
    expect([0, 0.4, 1.9].map((t) => standBob({ t, reduced: true }, 3))).toEqual([0, 0, 0]);
  });

  it('are drawn in the race, one ship each, in the fleets\' mascots, floating over a void tile', () => {
    setFleets([fleetRow('beaver', 'beaver'), fleetRow('shark', 'shark')]);
    const voids = voidTilesInView();
    expect(voids.length).toBeGreaterThan(3);
    const stands = voids.slice(0, 4);
    const track = parseTrack({ ...COMET_RING, stands });
    expect(track.stands).toHaveLength(4);
    sprites.length = 0;
    createKart({ seed: 3, track }).draw(recorder().ctx, at(3));
    const ships = sprites.filter((x) => x.name === 'beaver' || x.name === 'shark');
    expect(ships.length).toBeGreaterThan(0);
    expect(ships.length).toBeLessThanOrEqual(4);
    expect(new Set(ships.map((x) => x.name)).size).toBe(2);
    expect(STAND_LIFT).toBeGreaterThan(0);
  });

  it('draw the same ships in the same places in two reduced-motion frames', () => {
    const names = (t: number) => { sprites.length = 0; createKart({ seed: 3 }).draw(recorder().ctx, at(t, true)); return sprites.map((x) => [x.name, x.x, x.y, x.frame]); };
    expect(names(1)).toEqual(names(8.7));
  });
});

/** Whether a tile, or one of its neighbours, holds some road: the stands and the props stand further out. */
const nearRoad = (track: ReturnType<typeof parseTrack>, x: number, y: number) =>
  [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => roadAt(track, (x + dx + 0.5) * TILE, (y + dy + 0.5) * TILE)));

/** Void tiles of COMET RING a kart on the line sees ahead of it, nearest first. */
function voidTilesInView(): [number, number][] {
  const base = parseTrack({ ...COMET_RING, props: [], stands: [] });
  const v = viewFor(WIDE, base, newRace({ seed: 3, track: base, cast: [] }).player);
  const tiles = COMET_RING.rows.flatMap((row, y) => Array.from(row).flatMap((c, x) => (c === '.' && !nearRoad(base, x, y) ? [{ at: [x, y] as [number, number], p: project(v, (x + 0.5) * TILE, (y + 0.5) * TILE, 0) }] : [])));
  const seen = tiles.flatMap(({ at, p }) => (p && p.sx > 20 && p.sx < WIDE.w - 20 && p.sy < WIDE.h - 10 && p.z > 60 && p.z < 160 ? [{ at, z: p.z }] : []));
  return seen.sort((x, y) => x.z - y.z).map((o) => o.at);
}

describe('the station\'s props', () => {
  const at = (t: number, reduced = false): FrameState => ({ ...frame(WIDE), t, sceneT: t, reduced });

  it('pulse the lamps and turn the dishes, and hold both still when motion is reduced; cranes and containers never move', () => {
    expect(new Set([0, 0.2, 0.4, 0.6, 0.8].map((t) => propFrame('lamp', at(t)))).size).toBe(2);
    expect(new Set([0, 0.3, 0.7, 1, 1.3].map((t) => propFrame('dish', at(t)))).size).toBe(2);
    for (const t of [0, 0.7, 1.3, 2.9]) {
      for (const kind of ['lamp', 'dish', 'crane', 'container'] as const) expect(propFrame(kind, at(t, true)), kind).toBe(0);
      expect(propFrame('crane', at(t))).toBe(0);
      expect(propFrame('container', at(t))).toBe(0);
    }
  });

  it('are drawn from their own sprites when they stand in view', () => {
    const voids = voidTilesInView();
    const kinds = ['lamp', 'dish', 'crane', 'container'] as const;
    const props = kinds.map((kind, i) => ({ kind, x: voids[i]?.[0] ?? 0, y: voids[i]?.[1] ?? 0 }));
    const track = parseTrack({ ...COMET_RING, props });
    sprites.length = 0;
    createKart({ seed: 3, track }).draw(recorder().ctx, at(3));
    for (const kind of kinds) expect(sprites.some((x) => x.name === `prop-${kind}`), kind).toBe(true);
  });
});

describe('the sky\'s convoys, belt and big planet', () => {
  const at = (t: number, reduced = false): FrameState => ({ ...frame(WIDE), t, sceneT: t, reduced });
  const horizon = horizonOf(WIDE.h);
  const span = WIDE.w * 6;

  it('send three convoys of ships across the panorama, slowly, seeded from the race', () => {
    const a = convoyShips(7, 2, span, horizon, false);
    expect(a).toHaveLength(CONVOYS * CONVOY_SHIPS);
    expect(convoyShips(7, 2, span, horizon, false)).toEqual(a);
    expect(convoyShips(8, 2, span, horizon, false)).not.toEqual(a);
    const later = convoyShips(7, 3, span, horizon, false);
    expect(later).not.toEqual(a);
    for (const ship of a) { expect(ship.y).toBeGreaterThanOrEqual(0); expect(ship.y).toBeLessThan(horizon); }
  });

  it('hold the convoys still when motion is reduced', () => {
    expect(convoyShips(7, 1, span, horizon, true)).toEqual(convoyShips(7, 99, span, horizon, true));
  });

  it('draw the convoys\' ships as sprites in the frame, still when reduced', () => {
    const shown = (t: number, reduced: boolean) => { sprites.length = 0; createKart({ seed: 7 }).draw(recorder().ctx, at(t, reduced)); return sprites.filter((x) => x.name === 'sky-convoy').map((x) => [x.x, x.y]); };
    expect(shown(2, false)).toHaveLength(CONVOYS * CONVOY_SHIPS);
    expect(shown(2, false)).not.toEqual(shown(20, false));
    expect(shown(2, true)).toEqual(shown(20, true));
  });

  it('run an asteroid belt across the panorama, in the sky, the same for the same seed', () => {
    const rocks = beltRocks(7, span, horizon);
    expect(rocks).toHaveLength(BELT_ROCKS);
    expect(beltRocks(7, span, horizon)).toEqual(rocks);
    for (const r of rocks) { expect(r.y).toBeGreaterThan(0); expect(r.y).toBeLessThan(horizon); expect(r.x).toBeLessThan(span); }
  });

  it('raise a big planet at the horizon, bigger than the others, drawn behind them', () => {
    planets.length = 0;
    createKart({ seed: 3 }).draw(recorder().ctx, at(3));
    const [rising, ...others] = planets;
    expect(others).toHaveLength(2);
    expect(sure(rising, 'the rising planet').r).toBeGreaterThan(Math.max(...others.map((p) => p.r)));
    expect(sure(rising, 'the rising planet').cy).toBeGreaterThanOrEqual(horizon - 10);
  });
});

/** COMET RING with no tunnel: the same road, no roof. */
const openSource = (): TrackSource => Object.fromEntries(Object.entries(COMET_RING).filter(([k]) => k !== 'span')) as unknown as TrackSource;

describe('the tunnel in the game and on the minimap', () => {

  it('passes the roofed road to the terrain, so the tunnel shows in the game', () => {
    createKart({ seed: 3 }).draw(recorder().ctx, frame(WIDE));
    const roofed = sure(sure(terrain[0], 'a terrain pass').roofed, 'the roofed mask');
    expect(roofed).toBeInstanceOf(Uint8Array);
    expect(roofed.some((p) => p === 1)).toBe(true);
    terrain.length = 0;
    createKart({ seed: 3, track: parseTrack(openSource()) }).draw(recorder().ctx, frame(WIDE));
    expect(sure(sure(terrain[0], 'a terrain pass').roofed, 'the roofed mask').every((p) => p === 0)).toBe(true);
  });

  it('draws the tunnel in a lighter tint than the road at its height, and the walkway as road', () => {
    const tiles = minimapTiles(parseTrack(), { low: 0, high: 0 });
    const light = (x: number, y: number) => Number(/rgb\((\d+)/.exec(sure(tiles.find((t) => t.x === x && t.y === y), `tile ${x},${y}`).colour)?.[1] ?? 0);
    // The tunnel starts at (64.5, 15.5); the road before it, and the walkway, are not roofed.
    expect(light(64, 14)).toBeGreaterThan(light(64, 17));
    expect(light(64, 14)).toBeGreaterThan(light(64, 29));
    expect(light(34, 12)).toBe(light(64, 29));
  });
});
