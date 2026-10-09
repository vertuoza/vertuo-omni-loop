import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { DEFAULT_THEME } from '../theme';
import { LAPS } from '../kart/track';
import { markFor } from '../mark';
import { drawFrame } from './index.ts';
import { kartPress, loadKart, NOT_LOADED, PAGES, READY_LINE, TALL_SCENES, type KartStatus } from './kart.ts';
import { KartOverlay } from './kart.tsx';
import type { FrameState, KartDraw } from './common.ts';

// OMNI KART's text layer and scene (PRD 1359, slice 1): the loading and failure lines, the ready
// screen, the loader and what a press does before the race.

const text = (status: KartStatus, grid: Grid = WIDE, form: 'full' | 'handheld' = 'full') =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } }, createElement(KartOverlay, { status })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the kart scene on its grids', () => {
  it('is laid out on the tall grid on the Game Boy held upright, and on the wide grid elsewhere', () => {
    expect(TALL_SCENES).toEqual(['kart']);
    expect(PAGES).toEqual({});
    expect(gridFor('handheld', 'kart')).toBe(TALL);
    expect(gridFor('full', 'kart')).toBe(WIDE);
    expect(gridFor('advance', 'kart')).toBe(WIDE);
  });
});

describe('the kart text layer', () => {
  it('opens on the ready screen: COMET RING · 3 LAPS · PRESS START, on both grids', () => {
    expect(READY_LINE).toBe('COMET RING · 3 LAPS · PRESS START');
    expect(READY_LINE).toContain(`${LAPS} LAPS`);
    expect(text('ready')).toBe('COMET RING · 3 LAPS · PRESS START B GAME ROOM');
    expect(text('ready', TALL, 'handheld')).toBe('COMET RING · 3 LAPS · PRESS START B GAME ROOM');
  });

  it('shows LOADING… and only the way back while the game\'s code is on its way', () => {
    expect(text('loading')).toBe('LOADING… B GAME ROOM');
    expect(text('loading', TALL, 'handheld')).toBe('LOADING… B GAME ROOM');
    expect(renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'loading' })))).toContain('role="status"');
  });

  it('says the game did not load, A to retry, when the import failed, with the way back', () => {
    expect(NOT_LOADED).toBe('GAME DID NOT LOAD · A TO RETRY');
    expect(text('failed')).toBe('GAME DID NOT LOAD · A TO RETRY B GAME ROOM');
    expect(text('failed', TALL, 'handheld')).toBe('GAME DID NOT LOAD · A TO RETRY B GAME ROOM');
  });
});

describe('what a press does before the race', () => {
  it('imports again on A after a failure, and goes back to the room on B in every state', () => {
    expect(kartPress('failed', 'a')).toBe('retry');
    for (const status of ['loading', 'ready', 'failed'] as const) expect(kartPress(status, 'b'), status).toBe('back');
  });

  it('reads nothing else yet: A while loading or ready, START, SELECT and the arrows', () => {
    for (const action of ['a', 'start', 'select', 'left', 'right', 'up', 'down'] as const) {
      expect(kartPress('loading', action), `loading ${action}`).toBeNull();
      expect(kartPress('ready', action), `ready ${action}`).toBeNull();
    }
    for (const action of ['start', 'select', 'left', 'right', 'up', 'down'] as const) expect(kartPress('failed', action), `failed ${action}`).toBeNull();
  });
});

describe('loadKart', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('makes the game from the module it imports', async () => {
    const game: KartDraw = { draw: () => {} };
    expect(await loadKart(() => Promise.resolve({ createKart: () => game }))).toBe(game);
  });

  it('answers null and logs the error with console.error when the import fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('Failed to fetch dynamically imported module');
    expect(await loadKart(() => Promise.reject(boom))).toBeNull();
    expect(error).toHaveBeenCalledWith(boom);
  });

  it('answers null when making the game throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadKart(() => Promise.resolve({ createKart: () => { throw new Error('no canvas'); } }))).toBeNull();
    expect(error).toHaveBeenCalledOnce();
  });

  it('imports once per call: a retry imports again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi.fn<() => Promise<{ createKart: () => KartDraw }>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ createKart: () => ({ draw: () => {} }) });
    expect(await loadKart(load)).toBeNull();
    expect(await loadKart(load)).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('the kart canvas', () => {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, prop) => (prop in target ? target[prop] : (..._a: unknown[]) => { calls.push(String(prop)); }),
    set: (target, prop, value) => { target[prop] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  const frame = (kart?: KartDraw | null): FrameState => ({
    scene: 'kart', grid: WIDE, page: 0, join: { fleets: [], pick: 0, lockedAt: null, team: null, away: false, hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 } },
    view: null, layout: [], sel: 0, fleetSel: 0, t: 1, sceneT: 1, reduced: false, mark: markFor('Vertuoza', DEFAULT_THEME), theme: DEFAULT_THEME,
    ...(kart === undefined ? {} : { kart }),
  });

  it('draws the Omni sky while the game loads, or when it did not', () => {
    calls.length = 0;
    drawFrame(ctx, frame(null), 'title');
    expect(calls).toContain('fillRect');
    calls.length = 0;
    drawFrame(ctx, frame(), 'title');
    expect(calls).toContain('fillRect');
  });

  it('hands the frame to the game once it has loaded, and draws nothing of its own', () => {
    const seen: FrameState[] = [];
    calls.length = 0;
    const f = frame({ draw: (_c, s) => { seen.push(s); } });
    drawFrame(ctx, f, 'title');
    expect(seen).toEqual([f]);
    expect(calls).not.toContain('fillRect');
  });
});
