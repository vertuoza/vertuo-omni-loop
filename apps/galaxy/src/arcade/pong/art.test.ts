import { describe, expect, it } from 'vitest';
import { TALL, WIDE, type FrameState } from '../scenes/common.ts';
import { DEFAULT_THEME } from '../theme';
import { createPong } from './art';
import { fakeMic, settle } from './mic.fake';
import { OPTIONS_KEY, type OptionsStore } from './options';
import { BAND_HZ, LIMITS } from './rules';

// OMNI PONG's ready screen as the game holds it (PRD 2101): the limit set and kept, the microphone
// asked for once at a time, and the pitch meter's three states as the voice moves.

/** A browser's storage that keeps what it is given, across pages. */
function memory(): { store: () => OptionsStore; kept: Map<string, string> } {
  const kept = new Map<string, string>();
  return { kept, store: () => ({ getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => { kept.set(k, v); } }) };
}

async function micOn(heard: number | null = null) {
  const mic = fakeMic('on');
  const game = createPong({ mic, store: memory().store });
  game.press('a');
  await settle();
  mic.heard = heard;
  return { mic, game };
}

describe('the limit on the ready screen', () => {
  it('starts on MID, and ◀ ▶ step through LOW, MID and HIGH, stopping at the ends', () => {
    const game = createPong({ mic: fakeMic(), store: memory().store });
    expect(game.hud()).toMatchObject({ phase: 'ready', limit: 'MID', limitHz: LIMITS.MID, band: BAND_HZ, mic: 'off', steer: 'still', hz: null });
    game.press('left');
    expect(game.hud().limit).toBe('LOW');
    game.press('left');
    expect(game.hud().limit).toBe('LOW');
    game.press('right');
    game.press('right');
    game.press('right');
    expect(game.hud()).toMatchObject({ limit: 'HIGH', limitHz: LIMITS.HIGH });
  });

  it('keeps the choice after a reload', () => {
    const { store, kept } = memory();
    createPong({ mic: fakeMic(), store }).press('right');
    expect(JSON.parse(kept.get(OPTIONS_KEY) ?? 'null')).toEqual({ limit: 'HIGH' });
    expect(createPong({ mic: fakeMic(), store }).hud().limit).toBe('HIGH');
  });
});

describe('the microphone on the ready screen', () => {
  it('asks once on A, and not again while it asks or once it is on', async () => {
    const mic = fakeMic('on');
    const game = createPong({ mic, store: memory().store });
    game.press('a');
    expect(game.hud().mic).toBe('asking');
    game.press('a');
    expect(mic.asked).toBe(1);
    await settle();
    game.press('a');
    expect(mic.asked).toBe(1);
  });

  it('asks again on A once refused', async () => {
    const mic = fakeMic('blocked');
    const game = createPong({ mic, store: memory().store });
    game.press('a');
    await settle();
    mic.answer = 'on';
    game.press('a');
    await settle();
    expect(mic.asked).toBe(2);
    expect(game.hud().mic).toBe('on');
  });

  it('starts nothing on START, refused or not', async () => {
    const game = createPong({ mic: fakeMic('blocked'), store: memory().store });
    game.press('a');
    await settle();
    const before = game.hud();
    expect(game.press('start')).toEqual({ leave: false });
    expect(game.hud()).toEqual(before);
  });

  it('forgets an answer that comes after a pause: the microphone stays off', async () => {
    const mic = fakeMic('on');
    const game = createPong({ mic, store: memory().store });
    game.press('a');
    game.pause();
    await settle();
    expect(game.hud().mic).toBe('off');
  });
});

describe('the pitch meter', () => {
  it.each([
    [LIMITS.MID + 11, 'up'],
    [LIMITS.MID - 11, 'down'],
    [LIMITS.MID + 9, 'still'],
    [null, 'still'],
  ] as const)('reads %s Hz as %s against MID', async (heard, steer) => {
    const { game } = await micOn(heard);
    game.step(1 / 60);
    expect(game.hud()).toMatchObject({ steer, hz: heard === null ? null : Math.round(heard) });
  });

  it('reads the same voice against the limit chosen', async () => {
    const { game } = await micOn(LIMITS.MID);
    game.step(1 / 60);
    expect(game.hud().steer).toBe('still');
    game.press('left');
    expect(game.hud().steer).toBe('up');
    game.press('right');
    game.press('right');
    expect(game.hud().steer).toBe('down');
  });

  it('reads nothing while the microphone is off', () => {
    const mic = fakeMic('on');
    mic.heard = 400;
    const game = createPong({ mic, store: memory().store });
    game.step(1 / 60);
    expect(game.hud()).toMatchObject({ steer: 'still', hz: null });
  });
});

describe('the court', () => {
  it('draws its centre line and both paddles in the theme\'s colours, across the whole grid', () => {
    for (const grid of [WIDE, TALL]) {
      const rects: [string, number, number, number, number][] = [];
      let fill = '';
      const ctx = {
        set fillStyle(c: string) { fill = c; },
        fillRect: (x: number, y: number, w: number, h: number) => { rects.push([fill, x, y, w, h]); },
      } as unknown as CanvasRenderingContext2D;
      createPong({ mic: fakeMic(), store: memory().store }).draw(ctx, { grid, theme: DEFAULT_THEME } as FrameState);
      expect(rects.some(([c, x]) => c === DEFAULT_THEME.dim && x === grid.w / 2 - 1)).toBe(true);
      const cyan = rects.find(([c]) => c === DEFAULT_THEME.cyan);
      const plasma = rects.find(([c]) => c === DEFAULT_THEME.plasma);
      expect(cyan?.[1]).toBeLessThan(grid.w / 2);
      expect(plasma?.[1]).toBeGreaterThan(grid.w / 2);
      expect((plasma?.[1] ?? 0) + (plasma?.[3] ?? 0)).toBeLessThanOrEqual(grid.w);
    }
  });
});
