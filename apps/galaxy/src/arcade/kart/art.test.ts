import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, resolveTheme, TOKENS, type Theme, type Token } from '../theme';
import { markFor } from '../mark';
import { TALL, WIDE, type FrameState, type Grid } from '../scenes/common.ts';
import { sure } from '../test/sure';
import { createKart, viewFacing } from './art';
import type { Action } from '../keys';
import { horizonOf } from './mode7';

// The ready screen's drawing, under a canvas that only counts (PRD 1359): the sky above the horizon in
// the theme's colours, then the floor from one reused pixel buffer, on both grids. The planets and
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

describe('the race\'s drawing', () => {
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
    // (the item boxes standing on the floor are narrower than the screen: they are not the sky)
    expect(Math.max(...fills.filter((f) => f.rect[2] === grid.w).map((f) => (f.rect[1] ?? 0) + (f.rect[3] ?? 0)))).toBeLessThanOrEqual(horizon);
    // The floor is one buffer the size of the grid, put on a canvas once and drawn at the corner.
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ w: grid.w, h: grid.h });
    expect(images.filter((i) => i.length === 2).at(-1)).toEqual([0, 0]);
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

describe('the player\'s kart', () => {
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
    const [kart] = sprites;
    expect(kart).toMatchObject({ name: 'kart', scale });
    expect(sure(kart, 'the kart').x).toBe((grid.w - 28 * scale) / 2);
    expect(sure(kart, 'the kart').y + 18 * scale).toBeLessThan(grid.h);
    expect(sure(kart, 'the kart').y + 18 * scale).toBeGreaterThan(grid.h - 12);
  });

  it('is tinted with the hero\'s suit, the look the arcade draws the hero with', () => {
    createKart().draw(recorder().ctx, frame(WIDE));
    const [kart] = sprites;
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
    const kart = sure(sprites[0], 'the kart');
    expect(sure(dx, 'dx')).toBeGreaterThan(kart.x);
    expect(sure(dx, 'dx') + sure(dw, 'width')).toBeLessThan(kart.x + 28 * 4);
    expect(sure(dy, 'dy') + sure(dh, 'dh')).toBeLessThanOrEqual(kart.y + 10 * 4);
  });

  it('leans into the turn: left, straight, right', () => {
    const lean = (...b: Action[]) => { sprites.length = 0; raced(0.5, ...b).draw(recorder().ctx, frame(WIDE)); return sure(sprites[0], 'the kart').name; };
    expect(lean('a')).toBe('kart');
    expect(lean('a', 'left')).toBe('kart-left');
    expect(lean('a', 'right')).toBe('kart-right');
  });

  it('turns its tread with the speed, and holds still at rest or when motion is reduced', () => {
    const frameOf = (kart: ReturnType<typeof createKart>, reduced = false) => { sprites.length = 0; kart.draw(recorder().ctx, { ...frame(WIDE), reduced }); return sure(sprites[0], 'the kart').frame; };
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
  it('draws the item boxes as lit squares with a question mark, only while they are there', () => {
    const kart = createKart({ seed: 3 });
    kart.press('start');
    const held = new Set<Action>(['a']);
    let seen = 0;
    for (let t = 0; t < 12; t += 0.05) {
      kart.step(held, 0.05);
      if (t < 3.1) continue;
      const { ctx, fills } = recorder();
      kart.draw(ctx, frame(WIDE));
      seen += fills.filter((f) => f.style === DEFAULT_THEME.yellow).length;
    }
    expect(seen).toBeGreaterThan(0);
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
