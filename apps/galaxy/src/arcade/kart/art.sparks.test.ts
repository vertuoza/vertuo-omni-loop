import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME } from '../theme';
import { markFor } from '../mark';
import { TALL, WIDE, type FrameState, type Grid } from '../scenes/common.ts';
import type { Action } from '../keys';
import { createKart, KART_W, minimapAt, SHADOW } from './art';
import { newRace, press, step, type Race } from './race';
import { marksOf } from './fx';
import { RULES } from './rules';
import { FROST_EIGHT, parseTrack, surfaceAt, type Track } from './track';

// What the player sees of what its own kart throws, the drift's sparks (issue 2057) and its trail, snow, wind and smoke (issue 2061):
// a canvas that keeps, for every pixel, what was painted on it last.
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
const shownOf = (grid: Grid, colour: string): number => lastOf(grid, colour).reduce((n, v) => n + v, 0);

/** For every pixel of the screen, 1 where it shows a square of `colour` at the end of a frame; the minimap of `on` is left out. */
function lastOf(grid: Grid, colour: string, on: Track = track): Uint8Array {
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
  const map = minimapAt(grid, on);
  paint(map.x, map.y, map.w, map.h, false);
  return last;
}

/**
 * How many pixels over the player's kart (the last kart painted) show a square of `colour` at the end of a frame: across its sprite
 * and a sprite's width either side, from its top down to its wheels, where what it throws comes out of it. And the sprite's scale.
 */
function overKart(grid: Grid, colour: string, on: Track): { shown: number; scale: number } {
  const kart = (paints as Paint[]).filter((p) => p.kind === 'sprite' && p.name.startsWith('kart')).at(-1);
  if (kart?.kind !== 'sprite') throw new Error('no kart drawn');
  const last = lastOf(grid, colour, on);
  const w = KART_W * kart.scale;
  let shown = 0;
  for (let y = Math.max(0, Math.round(kart.y)); y < Math.min(grid.h, Math.round(kart.y + KART_H * kart.scale)); y++) {
    for (let x = Math.max(0, Math.round(kart.x - w)); x < Math.min(grid.w, Math.round(kart.x + 2 * w)); x++) shown += last[y * grid.w + x] ?? 0;
  }
  return { shown, scale: kart.scale };
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

/** A drive that takes the player's kart where it throws one effect: the steps before (what is held, how long), then what is held while it is measured. */
interface Drive { circuit?: string; track: Track; seed: number; colour: string; before: readonly (readonly [Action[], number])[]; held: Action[]; frames: number; throws: (race: Race) => boolean }

const frost = parseTrack(FROST_EIGHT);
const DRIVES: Readonly<Record<'trail' | 'snow' | 'wind' | 'smoke', Drive>> = {
  // GAS pressed during the 2 and held at GO: a rocket start's BOOST. No rival of seed 3 rockets off, so the only trail is the player's.
  trail: { seed: 3, track, colour: DEFAULT_THEME.cyan, before: [[[], 1.2], [['a'], 1.85]], held: ['a'], frames: 60, throws: (r) => r.fx.boost > 0 },
  // The rivals drive off first; then the top speed on FROST EIGHT's road, and a turn to the right onto the powder.
  snow: { circuit: 'frost-eight', seed: 5, track: frost, colour: DEFAULT_THEME.white, before: [[[], 6.05], [['a'], 2.5]], held: ['a', 'right'], frames: 90, throws: (r) => surfaceAt(frost, r.player.x, r.player.y) === 'powder' && r.player.speed > RULES.draftMin * RULES.topSpeed },
  // GAS during the 1, a normal start, right behind the rival in front on the grid: the slipstream builds.
  wind: { seed: 3, track, colour: DEFAULT_THEME.white, before: [[[], 2.2], [['a'], 0.85]], held: ['a'], frames: 90, throws: (r) => (r.fx.draft ?? 0) > 0 },
  // GAS held from the 3: the engine stalls at GO.
  smoke: { seed: 3, track, colour: DEFAULT_THEME.void, before: [[['a'], 3.05]], held: ['a'], frames: 60, throws: (r) => (r.stall ?? 0) > 0 },
};

describe('the player\'s own trail, snow, wind and smoke (issue 2061)', () => {
  const cases = (['trail', 'snow', 'wind', 'smoke'] as const).flatMap((effect) => [[effect, 'wide', WIDE], [effect, 'tall', TALL]] as const);
  it.each(cases)('the %s shows over the kart on the %s grid, frame after frame, while the kart throws it', (effect, _name, grid) => {
    // The game, and the same race stepped beside it to say in which frames the kart throws the effect (60 frames a second).
    const d = DRIVES[effect];
    const kart = createKart({ seed: d.seed, difficulty: 'easy', ...(d.circuit ? { circuit: d.circuit } : {}) });
    let race = press(newRace({ seed: d.seed, track: d.track, difficulty: 'easy' }), 'start').race;
    kart.press('start');
    const drive = (held: Action[]) => { kart.step(new Set(held), 1 / 60); race = step(race, new Set(held), 1 / 60).race; };
    for (const [held, seconds] of d.before) for (let t = 0; t < seconds - 1e-9; t += 1 / 60) drive(held);
    let thrown = 0, showing = 0, shown = 0, block = 0;
    for (let i = 0; i < d.frames; i++) {
      drive(d.held);
      if (!d.throws(race)) continue;
      paints.length = 0;
      kart.draw(canvas(), frame(grid, false));
      const over = overKart(grid, d.colour, d.track);
      thrown++;
      shown += over.shown;
      if (over.shown > 0) showing++;
      block = 16 * over.scale * over.scale; // a 4×4 block of the kart sprite's own pixels
    }
    // The drive made the kart throw it for a while.
    expect(thrown).toBeGreaterThanOrEqual(10);
    // In three frames out of four at least some of it shows, and on average at least a 4×4 block of the sprite's pixels.
    expect(showing).toBeGreaterThanOrEqual(thrown * 0.75);
    expect(shown).toBeGreaterThanOrEqual(thrown * block);
  });
});

/** How many pixels show a square of `colour` in the rows between the player's sprite and the screen's edge, across its sprite and a sprite's width either side. */
function underKart(grid: Grid, colour: string): { shown: number; scale: number } {
  const kart = (paints as Paint[]).filter((p) => p.kind === 'sprite' && p.name.startsWith('kart')).at(-1);
  if (kart?.kind !== 'sprite') throw new Error('no kart drawn');
  const last = lastOf(grid, colour, track);
  const w = KART_W * kart.scale;
  let shown = 0;
  for (let y = Math.max(0, Math.round(kart.y + KART_H * kart.scale)); y < grid.h; y++) {
    for (let x = Math.max(0, Math.round(kart.x - w)); x < Math.min(grid.w, Math.round(kart.x + 2 * w)); x++) shown += last[y * grid.w + x] ?? 0;
  }
  return { shown, scale: kart.scale };
}

describe('the player\'s own skid marks (PRD 2063)', () => {
  it.each([['wide', WIDE], ['tall', TALL]] as const)('show under the kart on the %s grid while it lays them', (_name, grid) => {
    // The drift of the sparks' test, the game and a pure race stepped beside it to say when the kart lays marks.
    const kart = createKart({ seed: 5, difficulty: 'easy' });
    let race = press(newRace({ seed: 5, track, difficulty: 'easy' }), 'start').race;
    kart.press('start');
    const drive = (held: Action[], seconds: number, measure = false) => {
      for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
        kart.step(new Set(held), 1 / 60);
        race = step(race, new Set(held), 1 / 60).race;
        if (!measure || marksOf(race).length === 0) continue;
        paints.length = 0;
        kart.draw(canvas(), frame(grid, false));
        const under = underKart(grid, DEFAULT_THEME['navy-dark']);
        laid++;
        shown += under.shown;
        if (under.shown > 0) showing++;
        block = 4 * under.scale * under.scale; // a 2×2 block of the sprite's own pixels
      }
    };
    let laid = 0, showing = 0, shown = 0, block = 0;
    drive([], 3.1);
    drive(['a'], 1.5);
    drive(['a', 'right'], 0.1);
    drive(['a'], 0.2);
    drive(['a', 'up', 'left'], 2, true);
    expect(laid).toBeGreaterThanOrEqual(10);
    expect(showing).toBeGreaterThanOrEqual(laid * 0.75);
    expect(shown).toBeGreaterThanOrEqual(laid * block);
  });

  it('are drawn after the kart\'s shadow and before its sprite, the rivals\' before the kart', () => {
    const kart = createKart({ seed: 5, difficulty: 'easy' });
    kart.press('start');
    const drive = (held: Action[], seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) kart.step(new Set(held), 1 / 60); };
    drive([], 3.1);
    drive(['a'], 1.5);
    drive(['a', 'right'], 0.1);
    drive(['a'], 0.2);
    drive(['a', 'up', 'left'], 1);
    paints.length = 0;
    kart.draw(canvas(), frame(WIDE, false));
    const all = paints as Paint[];
    const sprite = all.findLastIndex((p) => p.kind === 'sprite' && p.name.startsWith('kart'));
    const player = all[sprite];
    if (player?.kind !== 'sprite') throw new Error('no kart drawn');
    const shadow = all.findLastIndex((p, n) => n < sprite && p.kind === 'fill' && p.style === SHADOW);
    // A mark: a dark square under the sprite's bottom edge.
    const marks = all.map((p, n) => [p, n] as const).filter(([p]) => p.kind === 'fill' && p.style === DEFAULT_THEME['navy-dark'] && p.rect[2] === p.rect[3] && (p.rect[1] ?? 0) >= player.y + KART_H * player.scale - 1).map(([, n]) => n);
    expect(shadow).toBeGreaterThanOrEqual(0);
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((n) => n > shadow && n < sprite)).toBe(true);
  });
});
