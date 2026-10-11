import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { GAMES } from '../games';
import { cabinetDoor, cabinets, xpStatus } from '../games/room';
import { allowed } from '../onboarding';
import type { Session } from '../types';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import {
  duetPress, loadDuet, NOT_LOADED, PAGES, playfield, readyLine, sameDuetHud, TALL_SCENES, type ArcadeDuet, type DuetGame, type DuetHud, type DuetStatus,
} from './duet.ts';
import { DuetOverlay } from './duet.tsx';
import { duetDrawOf, loadedDuet, pressedDuet } from './duet.live';
import { createDuet } from '../duet/index';

// OMNI DUET's scene (PRD 1633, slice 2): the cabinet that opens it, the loader, the loading and failure
// lines, the ready screen, what a press does before play and where the playfield sits on each grid.

const READY: DuetHud = { phase: 'ready', chapter: { numeral: 'I', name: 'DRIFT' }, lives: 3, score: 0 };

const text = (status: DuetStatus, grid: Grid = WIDE, form: 'full' | 'handheld' = 'full', hud: DuetHud | null = READY) =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } }, createElement(DuetOverlay, { status, hud })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** A game that does nothing, as the loader hands it over. */
const stubGame = (): DuetGame => ({ draw: () => {}, step: () => {}, press: () => ({ leave: false }), hud: () => READY });

describe('the cabinet', () => {
  const row = (level: number, unlocked: string[]) => ({ xp: 300, level, unlocked });

  it('names the duet scene in the registry\'s fourth row', () => {
    expect(GAMES[3]).toEqual({ id: 'duet', title: 'OMNI DUET', scene: 'duet', measure: 'points' });
  });

  it('opens the duet scene at LV 4, and still refuses it at LV 3', () => {
    const lv4 = xpStatus(true, row(4, ['invaders', 'platformer', 'kart', 'duet']));
    expect(cabinetDoor(at(cabinets(lv4), 3, 'the fourth cabinet'), lv4)).toEqual({ scene: 'duet' });
    const lv3 = xpStatus(true, row(3, ['invaders', 'platformer', 'kart']));
    expect(cabinetDoor(at(cabinets(lv3), 3, 'the fourth cabinet'), lv3)).toEqual({ refused: 'REACH LV 4 TO PLAY' });
  });

  it('is a signed-in scene: a signed-out player is bounced to INSERT COIN, as from the other games', () => {
    const crew = { crew: true } as unknown as Session;
    for (const scene of ['invaders', 'platformer', 'kart', 'duet'] as const) {
      expect(allowed(scene, null), scene).toBe('coin');
      expect(allowed(scene, crew), scene).toBe(scene);
    }
  });
});

describe('the duet scene on its grids', () => {
  it('is laid out on the tall grid on the Game Boy held upright, and on the wide grid elsewhere', () => {
    expect(TALL_SCENES).toEqual(['duet']);
    expect(PAGES).toEqual({});
    expect(gridFor('handheld', 'duet')).toBe(TALL);
    expect(gridFor('full', 'duet')).toBe(WIDE);
    expect(gridFor('advance', 'duet')).toBe(WIDE);
  });

  it('fills the tall grid with the 320×288 playfield, and centres it on the wide grid scaled to its height', () => {
    expect(playfield(TALL)).toEqual({ x: 0, y: 0, scale: 1 });
    const wide = playfield(WIDE);
    expect(wide).toEqual({ x: 120, y: 0, scale: 1.25 });
    expect(wide.x * 2 + 320 * wide.scale).toBe(WIDE.w);
    expect(288 * wide.scale).toBe(WIDE.h);
  });
});

describe('the duet text layer', () => {
  it('opens on the ready screen: CHAPTER I · DRIFT · LIVES ×3 · PRESS START, on both grids', () => {
    expect(readyLine(READY)).toBe('CHAPTER I · DRIFT · LIVES ×3 · PRESS START');
    expect(text('ready')).toBe('CHAPTER I · DRIFT · LIVES ×3 · PRESS START B GAME ROOM');
    expect(text('ready', TALL, 'handheld')).toBe('CHAPTER I · DRIFT · LIVES ×3 · PRESS START B GAME ROOM');
  });

  it('says the chapter and the lives left on the ready screen', () => {
    expect(readyLine({ ...READY, chapter: { numeral: 'III', name: 'SPIN' }, lives: 2 })).toBe('CHAPTER III · SPIN · LIVES ×2 · PRESS START');
  });

  it('shows LOADING… and only the way back while the game\'s code is on its way', () => {
    expect(text('loading', WIDE, 'full', null)).toBe('LOADING… B GAME ROOM');
    expect(text('loading', TALL, 'handheld', null)).toBe('LOADING… B GAME ROOM');
    expect(renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(DuetOverlay, { status: 'loading' })))).toContain('role="status"');
  });

  it('says the game did not load, A to retry, when the import failed, with the way back', () => {
    expect(NOT_LOADED).toBe('GAME DID NOT LOAD · A TO RETRY');
    expect(text('failed', WIDE, 'full', null)).toBe('GAME DID NOT LOAD · A TO RETRY B GAME ROOM');
    expect(text('failed', TALL, 'handheld', null)).toBe('GAME DID NOT LOAD · A TO RETRY B GAME ROOM');
  });

  it('leaves the playfield clear once play has started', () => {
    expect(text('ready', WIDE, 'full', { ...READY, phase: 'play' })).toBe('');
    expect(text('ready', TALL, 'handheld', { ...READY, phase: 'play' })).toBe('');
  });

  it('tells two text layers apart by their phase, chapter, lives and score', () => {
    expect(sameDuetHud(null, null)).toBe(true);
    expect(sameDuetHud(null, READY)).toBe(false);
    expect(sameDuetHud(READY, { ...READY, chapter: { numeral: 'I', name: 'DRIFT' } })).toBe(true);
    expect(sameDuetHud(READY, { ...READY, phase: 'play' })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, lives: 2 })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, score: 10 })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, chapter: { numeral: 'II', name: 'SLIDE' } })).toBe(false);
  });
});

describe('what a press does before play', () => {
  it('imports again on A after a failure, and goes back to the room on B while loading, failed or ready', () => {
    expect(duetPress('failed', 'a')).toBe('retry');
    for (const status of ['loading', 'ready', 'failed'] as const) expect(duetPress(status, 'b'), status).toBe('back');
  });

  it('hands every other press to the game once it has loaded', () => {
    for (const action of ['a', 'start', 'select', 'left', 'right', 'up', 'down'] as const) {
      expect(duetPress('loading', action), `loading ${action}`).toBeNull();
      expect(duetPress('ready', action), `ready ${action}`).toBeNull();
    }
    for (const action of ['start', 'select', 'left', 'right', 'up', 'down'] as const) expect(duetPress('failed', action), `failed ${action}`).toBeNull();
  });

  it('leaves B to the game once play has started', () => {
    expect(duetPress('ready', 'b', 'play')).toBeNull();
    expect(duetPress('ready', 'b', 'ready')).toBe('back');
  });
});

describe('loadDuet', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('makes the game from the module it imports, with the seed it plays from', async () => {
    const game = stubGame();
    const createDuet = vi.fn(() => game);
    expect(await loadDuet(() => Promise.resolve({ createDuet }), 42)).toBe(game);
    expect(createDuet).toHaveBeenCalledWith({ seed: 42 });
  });

  it('answers null and logs the error with console.error when the import fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('Failed to fetch dynamically imported module');
    expect(await loadDuet(() => Promise.reject(boom))).toBeNull();
    expect(error).toHaveBeenCalledWith(boom);
  });

  it('answers null when making the game throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadDuet(() => Promise.resolve({ createDuet: () => { throw new Error('no canvas'); } }))).toBeNull();
    expect(error).toHaveBeenCalledOnce();
  });
});

describe('the duet scene in the arcade shell', () => {
  const loaded = (game: DuetGame = stubGame()): ArcadeDuet => ({ status: 'ready', retry: 0, grid: WIDE, game, hud: game.hud() });

  it('takes the loaded game, or the failure, into the state it holds', () => {
    const loading: ArcadeDuet = { status: 'loading', retry: 0, grid: TALL, game: null, hud: null };
    const game = stubGame();
    expect(loadedDuet(loading, game)).toEqual({ status: 'ready', retry: 0, grid: TALL, game, hud: READY });
    expect(loadedDuet(loading, null)).toEqual({ status: 'failed', retry: 0, grid: TALL, game: null, hud: null });
    expect(loadedDuet(null, game)).toBeNull(); // the scene was left while the code was on its way
  });

  it('draws the loaded game on its own scene only', () => {
    const d = loaded();
    expect(duetDrawOf('duet', d)).toBe(d.game);
    expect(duetDrawOf('games', d)).toBeNull();
    expect(duetDrawOf('duet', null)).toBeNull();
  });

  it('goes back to the room on B before play, and retries a failed import on A', () => {
    expect(pressedDuet(null, 'b')).toBe('back');
    expect(pressedDuet(null, 'a')).toBeNull();
    expect(pressedDuet(loaded(), 'b')).toBe('back');
    const failed: ArcadeDuet = { status: 'failed', retry: 1, grid: WIDE, game: null, hud: null };
    expect(pressedDuet(failed, 'a')).toEqual({ ...failed, status: 'loading', retry: 2 });
    expect(pressedDuet(failed, 'b')).toBe('back');
  });

  it('starts play on START from the ready screen, and changes nothing on another press', () => {
    expect(pressedDuet(loaded(createDuet({ seed: 1 })), 'start')).toMatchObject({ hud: { phase: 'play' } });
    const same = loaded(createDuet({ seed: 1 }));
    expect(pressedDuet(same, 'a')).toBe(same);
  });

  it('leaves B to the game once play has started', () => {
    const started = pressedDuet(loaded(createDuet({ seed: 1 })), 'start');
    if (!started || started === 'back') throw new Error('START did not start play');
    expect(pressedDuet(started, 'b')).toBe(started);
  });
});
