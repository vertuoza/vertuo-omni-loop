import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME } from '../theme';
import { markFor } from '../mark';
import { WIDE, type FrameState } from '../scenes/common.ts';
import { loadKart, type KartGame } from '../scenes/kart.ts';
import { cpuMs, median } from '../test/cost';
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
// first frame in about the time of the frames after it, on every circuit, and on a second race on the
// same circuit too. The first frame used to paint the circuit's ground and raise its relief: a second
// and more on a laptop, the screen frozen and the music stuttering. Timed against the race's own later
// frames, on the same machine, so a slower one has the same room. One first frame is one sample, so
// each race has its own room: before the fix a first race's first frame took 47 to 68 times a later
// one and a second race's 9.5 to 11; since, under a loaded machine, up to 5.2 and 2.2. Each frame is
// timed in the CPU time it took (../test/cost.ts): on the wall clock, the one first frame counted as
// its own the time a busy machine left it waiting (96 ms against 17 ms, beside a full test run).
vi.mock('@omni/design', async (original) => {
  const m = await original<typeof import('@omni/design')>();
  return { ...m, drawPlanet: () => {}, drawStarfield: () => {}, makeNebula: () => ({}), spriteImage: () => ({ width: 32, height: 48 }), drawSprite: () => {} };
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

/** The race on `track` as the arcade loads it, the player's options otherwise the defaults. */
const loaded = async (track: string): Promise<KartGame> => sure(await loadKart(() => import('./index'), 7, [], { ...defaultOptions(), track }), 'the race');

describe('a race\'s first frame (bug 2152)', () => {
  it.each(CIRCUITS.map((c) => [c.name, c.id] as const))('draws %s\'s first frame in at most 15 times a frame after it on its first race, and 5 times on a second one', async (_name, track) => {
    for (const [race, room] of [['first race', 15], ['second race', 5]] as const) {
      const game = await loaded(track);
      const first = cpuMs(() => { game.draw(ctx, frame(3)); });
      const later = median([4, 5, 6, 7, 8].map((t) => cpuMs(() => { game.draw(ctx, frame(t)); })));
      expect(first / later, `${race}: the first frame in ${first.toFixed(0)} ms of CPU, the frames after it in ${later.toFixed(0)} ms`).toBeLessThanOrEqual(room);
    }
  });
});

/** COMET RING as a circuit no race has read yet: its own waypoints, so nothing of it is remembered. */
const unread = (): TrackSource => ({ ...COMET_RING, waypoints: [...COMET_RING.waypoints] });

/** Runs `work` to its end, counting the times it stopped. */
const counted = <T>(work: Steps<T>): { stops: number; value: T } => {
  let stops = 0;
  for (;;) {
    const step = work.next();
    if (step.done) return { stops, value: step.value };
    stops += 1;
  }
};

describe('a circuit\'s ground, built a slice at a time (bug 2152)', () => {
  it('pauses between slices while a race builds it, and not at all for a second race on the same circuit', async () => {
    const src = unread();
    let pauses = 0;
    const pause = () => { pauses += 1; return Promise.resolve(); };
    await createKart({ seed: 7, track: parseTrack(src) }).ready(pause);
    expect(pauses, 'the first race').toBeGreaterThan(0);
    pauses = 0;
    await createKart({ seed: 8, track: parseTrack(src) }).ready(pause);
    expect(pauses, 'the second race').toBe(0);
  });

  it('paints the circuit, raises its relief and reads its tunnel stopping after every row of pixels', () => {
    const track = parseTrack(unread());
    const painted = counted(painting(track));
    const { h } = painted.value;
    expect(painted.stops, 'the paint').toBeGreaterThanOrEqual(h);
    expect(counted(raising(track, painted.value)).stops, 'the relief').toBeGreaterThanOrEqual(h);
    // The tunnel's mask, then its vault: two passes of a chamfer and the ceiling over it.
    expect(counted(tunnelling(track, painted.value)).stops, 'the tunnel').toBeGreaterThanOrEqual(4 * h);
  });
});
