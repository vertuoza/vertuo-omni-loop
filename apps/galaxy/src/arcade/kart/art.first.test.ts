import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME } from '../theme';
import { markFor } from '../mark';
import { WIDE, type FrameState } from '../scenes/common.ts';
import { loadKart, type KartGame } from '../scenes/kart.ts';
import { sure } from '../test/sure';
import { createKart } from './art';
import { CIRCUITS } from './circuits';
import { tunnelling } from './mode7';
import { defaultOptions } from './options';
import { raising } from './relief';
import type { Steps } from './slices';
import { painting } from './texture';
import { COMET_RING, parseTrack, type TrackSource } from './track';

// A race's first frame (bug 2152): once LOADING… is over, the race the arcade was handed draws its
// first frame without building any of the circuit's ground, on every circuit, and on a second race on
// the same circuit too. The first frame used to paint the circuit's ground and raise its relief: a second
// and more on a laptop, the screen frozen and the music stuttering. Counted in rows of pixels of ground,
// not timed: a first frame still runs its drawing code cold, two to three times a later frame on a
// shared CI runner, with no ground in it.
vi.mock('@omni/design', async (original) => {
  const m = await original<typeof import('@omni/design')>();
  return { ...m, drawPlanet: () => {}, drawStarfield: () => {}, makeNebula: () => ({}), spriteImage: () => ({ width: 32, height: 48 }), drawSprite: () => {} };
});

/** Every row of ground run at once, by a draw or anything else: the paint, the relief, the mask and the vault all stop after each row. */
const drained = vi.hoisted(() => ({ rows: 0 }));
vi.mock('./slices', async (original) => {
  const m = await original<typeof import('./slices')>();
  function* counting<T>(work: Steps<T>): Steps<T> {
    for (;;) {
      const step = work.next();
      if (step.done) return step.value;
      drained.rows += 1;
      yield;
    }
  }
  return { ...m, drain: <T>(work: Steps<T>): T => m.drain(counting(work)) };
});

class FakeImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); }
}

beforeEach(() => {
  vi.stubGlobal('ImageData', FakeImageData);
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData: () => {} }) }) });
});
afterEach(() => { vi.unstubAllGlobals(); });

/** A canvas that draws nothing: every call answers nothing, every property keeps what it was given. */
const ctx = new Proxy<Record<string | symbol, unknown>>({}, {
  get: (target, prop) => (prop in target ? target[prop] : () => {}),
  set: (target, prop, value) => { target[prop] = value; return true; },
}) as unknown as CanvasRenderingContext2D;

const frame = (t: number): FrameState => ({
  scene: 'kart', grid: WIDE, page: 0, join: { fleets: [], pick: 0, lockedAt: null, team: null, away: false, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
  view: null, layout: [], sel: 0, fleetSel: 0, t, sceneT: t, reduced: false, mark: markFor('Vertuoza', DEFAULT_THEME), theme: DEFAULT_THEME,
});

/** The rows of ground `draw` builds. */
const rowsBuilt = (draw: () => void): number => {
  drained.rows = 0;
  draw();
  return drained.rows;
};

/** The race on `track` as the arcade loads it, the player's options otherwise the defaults. */
const loaded = async (track: string): Promise<KartGame> => sure(await loadKart(() => import('./index'), 7, [], { ...defaultOptions(), track }), 'the race');

/** `source` as a circuit no race has read yet: its own waypoints, so nothing of it is remembered. */
const unread = (source: TrackSource): TrackSource => ({ ...source, waypoints: [...source.waypoints] });
/** The source of the circuit `id`. */
const sourceOf = (id: string): TrackSource => sure(CIRCUITS.find((c) => c.id === id), id).source;

/** Runs `work` to its end, counting the times it stopped. */
const counted = <T>(work: Steps<T>): { stops: number; value: T } => {
  let stops = 0;
  for (;;) {
    const step = work.next();
    if (step.done) return { stops, value: step.value };
    stops += 1;
  }
};

/** The rows of a whole ground: the circuit painted, its relief raised and its tunnel read, as a race builds them. */
const wholeGround = (source: TrackSource): number => {
  const track = parseTrack(unread(source));
  const painted = counted(painting(track));
  return painted.stops + counted(raising(track, painted.value)).stops + counted(tunnelling(track, painted.value)).stops;
};

describe('a race\'s first frame (bug 2152)', () => {
  it.each(CIRCUITS.map((c) => [c.name, c.id] as const))('draws %s\'s first frame without building a row of its ground, on its first race and on a second one', async (_name, track) => {
    for (const race of ['first race', 'second race']) {
      const game = await loaded(track);
      expect(rowsBuilt(() => { game.draw(ctx, frame(3)); }), `${race}: the rows of ground the first frame built`).toBe(0);
    }
  });

  // What the guard above would see of the bug: a race drawn before its ground is built builds all of it on its first frame.
  it.each(CIRCUITS.map((c) => [c.name, c.id] as const))('counts the whole of %s\'s ground on the first frame of a race drawn before it is ready', (_name, id) => {
    const whole = wholeGround(sourceOf(id));
    const game = createKart({ seed: 7, track: parseTrack(unread(sourceOf(id))) });
    expect(whole, 'the rows of a whole ground').toBeGreaterThan(0);
    expect(rowsBuilt(() => { game.draw(ctx, frame(3)); }), 'the rows of ground the first frame built').toBeGreaterThanOrEqual(whole);
  });
});

describe('a circuit\'s ground, built a slice at a time (bug 2152)', () => {
  it('pauses between slices while a race builds it, and not at all for a second race on the same circuit', async () => {
    const src = unread(COMET_RING);
    let pauses = 0;
    const pause = () => { pauses += 1; return Promise.resolve(); };
    await createKart({ seed: 7, track: parseTrack(src) }).ready(pause);
    expect(pauses, 'the first race').toBeGreaterThan(0);
    pauses = 0;
    await createKart({ seed: 8, track: parseTrack(src) }).ready(pause);
    expect(pauses, 'the second race').toBe(0);
  });

  it('paints the circuit, raises its relief and reads its tunnel stopping after every row of pixels', () => {
    const track = parseTrack(unread(COMET_RING));
    const painted = counted(painting(track));
    const { h } = painted.value;
    expect(painted.stops, 'the paint').toBeGreaterThanOrEqual(h);
    expect(counted(raising(track, painted.value)).stops, 'the relief').toBeGreaterThanOrEqual(h);
    // The tunnel's mask, then its vault: two passes of a chamfer and the ceiling over it.
    expect(counted(tunnelling(track, painted.value)).stops, 'the tunnel').toBeGreaterThanOrEqual(4 * h);
  });
});
