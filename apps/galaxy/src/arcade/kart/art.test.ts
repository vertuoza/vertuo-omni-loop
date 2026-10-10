import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, resolveTheme, TOKENS, type Theme, type Token } from '../theme';
import { markFor } from '../mark';
import { TALL, WIDE, type FrameState, type Grid } from '../scenes/common.ts';
import { sure } from '../test/sure';
import { boxFrame, cameraFor, cometsOf, createKart, fallenOf, hiddenBlink, KART_WORLD, propFrame, SHADOW, viewFacing } from './art';
import { RULES } from './rules';
import type { Action } from '../keys';
import { horizonOf, project, viewOf } from './mode7';
import { newRace } from './race';
import { parseTrack } from './track';

// The ready screen's drawing, under a canvas that only counts (PRD 1359): the space the circuit floats in,
// above the horizon and under it, in the theme's colours, then the floor from one reused pixel buffer, on both grids. The planets and
// nebulae of @omni/design are its own, and stubbed out here.
const planets = vi.hoisted(() => [] as { cy: number; r: number }[]);
const sprites = vi.hoisted(() => [] as { name: string; x: number; y: number; scale: number | undefined; tint: unknown; frame: number | undefined }[]);
vi.mock('@omni/design', async (original) => {
  const m = await original<typeof import('@omni/design')>();
  return {
    ...m,
    drawPlanet: (_ctx: unknown, o: { cy: number; r: number }) => { planets.push({ cy: o.cy, r: o.r }); },
    drawStarfield: () => {},
    makeNebula: () => ({}),
    spriteImage: () => ({ width: 32, height: 48 }),
    drawSprite: (_ctx: unknown, name: string, x: number, y: number, o: { scale?: number; tint?: unknown; frame?: number } = {}) => { sprites.push({ name, x, y, scale: o.scale, tint: o.tint, frame: o.frame }); },
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
  puts.length = 0; created.length = 0; planets.length = 0; sprites.length = 0;
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
  /** Everything drawn, in order: the fills by their colour, the images and the sprites by name. */
  const order: string[] = [];
  const colours = new Set<string>();
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'fillRect') return (...rect: number[]) => { fills.push({ style: String(state['fillStyle']), rect }); order.push(`fill ${String(state['fillStyle'])}`); };
      if (prop === 'drawImage') return (_i: unknown, ...at: number[]) => { images.push(at); order.push('image'); };
      return () => {};
    },
    set(target, prop, value) {
      if (prop === 'fillStyle' && typeof value === 'string') colours.add(value);
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, images, colours, order };
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
    expect(planets).toHaveLength(2);
    const big = sure(planets[0], 'the planet');
    expect(big.cy).toBeLessThan(horizon);
    expect(big.cy + big.r).toBeGreaterThan(horizon);
  });

  it('puts nothing in the buffer above the horizon, and under it a floor that is see-through over the void', () => {
    createKart().draw(recorder().ctx, frame(WIDE));
    const { pixels } = sure(puts[0], 'the floor');
    const horizon = horizonOf(WIDE.h);
    for (let row = 0; row <= horizon; row++) expect(pixels.slice(row * WIDE.w, (row + 1) * WIDE.w).every((p) => p === 0), `row ${row}`).toBe(true);
    const under = pixels.slice((horizon + 1) * WIDE.w);
    expect(under.every((p) => p >>> 24 === 0 || p >>> 24 === 0xff)).toBe(true);
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

  it('is tinted with the hero\'s suit, the look the arcade draws the hero with', () => {
    createKart().draw(recorder().ctx, frame(WIDE));
    const kart = playerSprite();
    expect(sure(kart, 'the kart').tint).toBeTruthy();
    expect(sure(kart, 'the kart').tint).toHaveProperty('Y');
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
    let seen = 0, empty = 0;
    for (let t = 0; t < 12; t += 0.05) {
      kart.step(held, 0.05);
      if (t < 3.1) continue;
      const { ctx } = recorder();
      sprites.length = 0;
      kart.draw(ctx, frame(WIDE));
      const boxes = sprites.filter((x) => x.name === 'item-box').length;
      seen += boxes;
      if (boxes === 0) empty++;
    }
    expect(seen).toBeGreaterThan(0);
    expect(empty).toBeGreaterThan(0);
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
      return r.fills.filter((f) => f.style === DEFAULT_THEME.white && f.rect[2] === f.rect[3]);
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
    const pylons = named(drawn(), 'prop-pylon').map((x) => ({ ...x, scale: sure(x.scale, 'a scale') }));
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
    expect(list).toHaveLength(2);
    const [big, small] = [sure(list[0], 'the first planet'), sure(list[1], 'the second planet')];
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
    const drawn = times.map((t) => skyOf(7, at(t)).fills.filter((f) => (f.rect[1] ?? horizon) < horizon && f.rect[2] !== undefined && f.rect[2] < 16));
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
