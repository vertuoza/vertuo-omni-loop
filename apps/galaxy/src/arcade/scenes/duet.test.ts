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
  bannerLine, duetPress, duetRetry, loadDuet, NOT_LOADED, overLines, PAGES, playfield, readyLine, readyParts, sameDuetHud, TALL_SCENES, waveLine,
  type ArcadeDuet, type DuetGame, type DuetHud, type DuetStatus,
} from './duet.ts';
import { DuetOverlay } from './duet.tsx';
import { duetDrawOf, loadedDuet, pausedDuet, pressedDuet, steppedDuet, type DuetHooks } from './duet.live';
import { failed, saved, sending, type ScoreSend } from './invaders-score';
import { createDuet } from '../duet/index';
import { CHAPTERS, route } from '../duet/waves';

// OMNI DUET's scene (PRD 1633): the cabinet that opens it, the loader, the loading and failure lines,
// the ready screen, what a press does before play and where the playfield sits on each grid (slice 2);
// the HUD, the chapter's banner and the line a run ends on (slice 3); endless mode's lines, the pause,
// the game over with its score's send, and the score sent once whichever way the run ended (slice 4).

const READY: DuetHud = {
  phase: 'ready', chapter: { numeral: 'I', name: 'DRIFT' }, endless: false, wave: 1, waves: 10, lives: 3, score: 0, passed: 0, started: false,
};

const text = (status: DuetStatus, grid: Grid = WIDE, form: 'full' | 'handheld' = 'full', hud: DuetHud | null = READY, send: ScoreSend | null = null) =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } }, createElement(DuetOverlay, { status, hud, send })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** A game that does nothing, as the loader hands it over. */
const stubGame = (): DuetGame => ({
  draw: () => {}, step: () => ({ over: false }), press: () => ({ leave: false, over: false, again: false }), pause: () => {}, hud: () => READY,
});

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

  it('breaks the ready line between the chapter and the call, never inside either', () => {
    expect(readyParts(READY)).toEqual(['CHAPTER I · DRIFT ·', 'LIVES ×3 · PRESS START']);
    const markup = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(DuetOverlay, { status: 'ready', hud: READY })));
    expect(markup).toContain('<span class="dt-half">CHAPTER I · DRIFT ·</span> <span class="dt-half">LIVES ×3 · PRESS START</span>');
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

  it('shows only the HUD in play: the score, the chapter and wave, and the lives left, on both grids', () => {
    const playing: DuetHud = { ...READY, phase: 'play', chapter: { numeral: 'II', name: 'SLIDE' }, wave: 4, lives: 2, score: 130 };
    expect(waveLine(playing)).toBe('CH II · 4/10');
    expect(text('ready', WIDE, 'full', playing)).toBe('SCORE 130 WAVE CH II · 4/10 LIVES ×2');
    expect(text('ready', TALL, 'handheld', playing)).toBe('SCORE 130 WAVE CH II · 4/10 LIVES ×2');
  });

  it('shows the next chapter\'s banner over the HUD between two chapters', () => {
    const banner: DuetHud = { ...READY, phase: 'chapter', chapter: { numeral: 'III', name: 'SPIN' }, score: 200 };
    expect(bannerLine(banner)).toBe('CHAPTER III · SPIN');
    expect(text('ready', WIDE, 'full', banner)).toBe('SCORE 200 WAVE CH III · 1/10 LIVES ×3 CHAPTER III · SPIN');
    expect(text('ready', TALL, 'handheld', banner)).toBe('SCORE 200 WAVE CH III · 1/10 LIVES ×3 CHAPTER III · SPIN');
  });

  it('says the ready screen\'s chapter and lives again after a life lost, with no HUD over it', () => {
    const again: DuetHud = { ...READY, chapter: { numeral: 'III', name: 'SPIN' }, lives: 1, score: 200 };
    expect(text('ready', WIDE, 'full', again)).toBe('CHAPTER III · SPIN · LIVES ×1 · PRESS START B GAME ROOM');
  });

  it('ends on the score reached, the waves passed and where the run got to, with A to play again and B to the room', () => {
    const over: DuetHud = { ...READY, phase: 'over', lives: 0, score: 70, wave: 8, passed: 7, started: true };
    expect(overLines(over)).toEqual(['WAVES PASSED 7', 'REACHED CH I · 8/10']);
    expect(text('ready', WIDE, 'full', over)).toBe('GAME OVER SCORE 70 WAVES PASSED 7 REACHED CH I · 8/10 A PLAY AGAIN B GAME ROOM');
    expect(text('ready', TALL, 'handheld', over)).toBe('GAME OVER SCORE 70 WAVES PASSED 7 REACHED CH I · 8/10 A PLAY AGAIN B GAME ROOM');
  });

  it('says the score\'s send on the game over: saving, NEW BEST, the best, or not saved with A to retry', () => {
    const over: DuetHud = { ...READY, phase: 'over', lives: 0, score: 120, wave: 3, passed: 12, chapter: { numeral: 'II', name: 'SLIDE' }, started: true };
    const tail = 'WAVES PASSED 12 REACHED CH II · 3/10';
    expect(text('ready', WIDE, 'full', over, sending(120))).toBe(`GAME OVER SCORE 120 SAVING SCORE… ${tail} A PLAY AGAIN B GAME ROOM`);
    expect(text('ready', WIDE, 'full', over, saved(sending(120), 120, 90))).toBe(`GAME OVER SCORE 120 NEW BEST ${tail} A PLAY AGAIN B GAME ROOM`);
    expect(text('ready', TALL, 'handheld', over, saved(sending(120), 300, 300))).toBe(`GAME OVER SCORE 120 YOUR BEST 300 ${tail} A PLAY AGAIN B GAME ROOM`);
    expect(text('ready', WIDE, 'full', over, failed(sending(120)))).toBe(`GAME OVER SCORE 120 SCORE NOT SAVED ${tail} A RETRY B GAME ROOM`);
    expect(text('ready', WIDE, 'full', over, failed(sending(120, 2)))).toBe(`GAME OVER SCORE 120 SCORE NOT SAVED ${tail} A PLAY AGAIN B GAME ROOM`);
  });

  it('says ENDLESS ×2 on the ready screen, the HUD and the game over in endless mode, and ENDLESS · ×2 on its banner', () => {
    const endless: DuetHud = { ...READY, chapter: { numeral: 'IV', name: 'STORM' }, endless: true, wave: 12, waves: 0, lives: 2, score: 620, passed: 51, started: true };
    expect(readyLine(endless)).toBe('ENDLESS ×2 · LIVES ×2 · PRESS START');
    expect(text('ready', WIDE, 'full', endless)).toBe('ENDLESS ×2 · LIVES ×2 · PRESS START B END GAME');
    expect(waveLine(endless)).toBe('ENDLESS ×2 · WAVE 12');
    expect(text('ready', TALL, 'handheld', { ...endless, phase: 'play' })).toBe('SCORE 620 WAVE ENDLESS ×2 · WAVE 12 LIVES ×2');
    expect(bannerLine({ ...endless, wave: 1 })).toBe('ENDLESS · ×2');
    expect(text('ready', WIDE, 'full', { ...endless, phase: 'chapter', wave: 1, score: 400, passed: 40 })).toBe('SCORE 400 WAVE ENDLESS ×2 · WAVE 1 LIVES ×2 ENDLESS · ×2');
    expect(overLines({ ...endless, phase: 'over' })).toEqual(['WAVES PASSED 51', 'REACHED ENDLESS ×2 · WAVE 12']);
  });

  it('shows the pause over the HUD: START resumes, SELECT ends the game', () => {
    const paused: DuetHud = { ...READY, phase: 'paused', wave: 4, score: 30, started: true };
    // A computer's keyboard names ENTER and TAB; the Game Boy held upright its own START and SELECT.
    expect(text('ready', WIDE, 'full', paused)).toBe('SCORE 30 WAVE CH I · 4/10 LIVES ×3 PAUSED ENTER RESUME TAB END GAME');
    expect(text('ready', TALL, 'handheld', paused)).toBe('SCORE 30 WAVE CH I · 4/10 LIVES ×3 PAUSED START RESUME SELECT END GAME');
  });

  it('says B ends the game on a ready screen once play has started, and leaves for the room on the first', () => {
    expect(text('ready', WIDE, 'full', READY)).toContain('B GAME ROOM');
    expect(text('ready', WIDE, 'full', { ...READY, lives: 2, started: true })).toBe('CHAPTER I · DRIFT · LIVES ×2 · PRESS START B END GAME');
  });

  it('tells two text layers apart by their phase, chapter, wave, lives and score', () => {
    expect(sameDuetHud(READY, { ...READY, wave: 2 })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, waves: 9 })).toBe(false);
    expect(sameDuetHud(null, null)).toBe(true);
    expect(sameDuetHud(null, READY)).toBe(false);
    expect(sameDuetHud(READY, { ...READY, chapter: { numeral: 'I', name: 'DRIFT' } })).toBe(true);
    expect(sameDuetHud(READY, { ...READY, phase: 'play' })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, lives: 2 })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, score: 10 })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, chapter: { numeral: 'II', name: 'SLIDE' } })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, endless: true })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, passed: 1 })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, started: true })).toBe(false);
    expect(sameDuetHud(READY, { ...READY, phase: 'paused' })).toBe(false);
  });
});

describe('what a press does around the game', () => {
  it('imports again on A after a failure, and goes back to the room on B while loading or failed', () => {
    expect(duetPress('failed', 'a')).toBe('retry');
    for (const status of ['loading', 'failed'] as const) expect(duetPress(status, 'b'), status).toBe('back');
  });

  it('hands every press to the game once it has loaded, B included: the game knows whether play has started', () => {
    for (const action of ['a', 'b', 'start', 'select', 'left', 'right', 'up', 'down'] as const) expect(duetPress('ready', action), `ready ${action}`).toBeNull();
    for (const action of ['a', 'start', 'select', 'left', 'right', 'up', 'down'] as const) expect(duetPress('loading', action), `loading ${action}`).toBeNull();
    for (const action of ['start', 'select', 'left', 'right', 'up', 'down'] as const) expect(duetPress('failed', action), `failed ${action}`).toBeNull();
  });

  it('retries a score not saved on A at the game over, once, and otherwise lets A play again', () => {
    const over: DuetHud = { ...READY, phase: 'over', lives: 0, score: 50 };
    expect(duetRetry(over, failed(sending(50)), 'a')).toBe(true);
    expect(duetRetry(over, failed(sending(50, 2)), 'a')).toBe(false);
    expect(duetRetry(over, failed(sending(50)), 'b')).toBe(false);
    expect(duetRetry(over, sending(50), 'a')).toBe(false);
    expect(duetRetry(over, saved(sending(50), 50, null), 'a')).toBe(false);
    expect(duetRetry({ ...over, phase: 'ready' }, failed(sending(50)), 'a')).toBe(false);
    expect(duetRetry(null, failed(sending(50)), 'a')).toBe(false);
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
    expect(pressedDuet(loaded(createDuet({ seed: 1 })), 'b')).toBe('back');
    const failed: ArcadeDuet = { status: 'failed', retry: 1, grid: WIDE, game: null, hud: null };
    expect(pressedDuet(failed, 'a')).toEqual({ ...failed, status: 'loading', retry: 2 });
    expect(pressedDuet(failed, 'b')).toBe('back');
  });

  it('starts play on START from the ready screen, and changes nothing on another press', () => {
    expect(pressedDuet(loaded(createDuet({ seed: 1 })), 'start')).toMatchObject({ hud: { phase: 'play' } });
    const same = loaded(createDuet({ seed: 1 }));
    expect(pressedDuet(same, 'a')).toBe(same);
  });

  it('goes back to the room on B once the run is over, as the game says', () => {
    const over: DuetHud = { ...READY, phase: 'over', lives: 0 };
    const game: DuetGame = { ...stubGame(), hud: () => over, press: (a) => ({ leave: a === 'b', over: false, again: false }) };
    expect(pressedDuet(loaded(game), 'b')).toBe('back');
    expect(pressedDuet(loaded(game), 'start')).toEqual(loaded(game));
  });

  it('pauses the game from outside, and only START resumes it', () => {
    const started = pressedDuet(loaded(createDuet({ seed: 1 })), 'start');
    if (!started || started === 'back') throw new Error('START did not start play');
    const paused = pausedDuet(started);
    expect(paused?.hud?.phase).toBe('paused');
    expect(pausedDuet(null)).toBeNull();
    const loading: ArcadeDuet = { status: 'loading', retry: 0, grid: WIDE, game: null, hud: null };
    expect(pausedDuet(loading)).toBe(loading);
    if (!paused) throw new Error('no pause');
    for (const action of ['a', 'left', 'right', 'up', 'down'] as const) expect(pressedDuet(paused, action), action).toBe(paused);
    expect(pressedDuet(paused, 'start')).toMatchObject({ hud: { phase: 'play' } });
  });
});

describe('the score sent once', () => {
  /** The arcade's side of the game: every score handed over to be sent, and every new game begun. */
  function arcade() {
    const sent: number[] = [];
    let again = 0;
    const on: DuetHooks = { over: (score) => { sent.push(score); }, again: () => { again += 1; } };
    return { sent, on, again: () => again };
  }
  const opened = (): ArcadeDuet => {
    const game = createDuet({ seed: 1 });
    return { status: 'ready', retry: 0, grid: WIDE, game, hud: game.hud() };
  };
  /** The next state of a press, which must stay on the scene. */
  const pressed = (d: ArcadeDuet, action: Parameters<typeof pressedDuet>[1], on: DuetHooks): ArcadeDuet => {
    const next = pressedDuet(d, action, on);
    if (!next || next === 'back') throw new Error(`${action} left the scene`);
    return next;
  };
  /** Holds still, frame after frame, until a block hits: the life lost, on a ready screen, or the run over. */
  function untilHit(d: ArcadeDuet, on: DuetHooks): ArcadeDuet {
    let s = d;
    for (let i = 0; i < 2000 && s.hud?.phase === 'play'; i++) s = steppedDuet(s, s.game as DuetGame, new Set(), 1 / 60, on);
    return s;
  }

  it('sends the score reached when the last life is lost, once', () => {
    const { sent, on } = arcade();
    let d = pressed(opened(), 'start', on);
    while (d.hud?.phase !== 'over') {
      d = untilHit(d, on);
      if (d.hud?.phase === 'ready') d = pressed(d, 'start', on);
    }
    expect(sent).toEqual([d.hud.score]);
    for (const action of ['start', 'select', 'up'] as const) d = pressed(d, action, on);
    d = steppedDuet(d, d.game as DuetGame, new Set(['left']), 0.05, on);
    expect(sent).toHaveLength(1);
  });

  it('sends the score reached on SELECT on the pause, once', () => {
    const { sent, on } = arcade();
    let d = pressed(opened(), 'start', on);
    // Turned through chapter I's first wave, which orbs held still cannot pass: the score is then above 0.
    for (const dir of route(at(at(CHAPTERS, 0, 'chapter I').waves, 0, "chapter I's first wave"), 0) ?? []) {
      d = steppedDuet(d, d.game as DuetGame, new Set<'left' | 'right'>(dir === 1 ? ['left'] : dir === -1 ? ['right'] : []), 1 / 60, on);
    }
    d = pressed(pressed(d, 'start', on), 'select', on);
    expect(d.hud).toMatchObject({ phase: 'over' });
    expect(sent).toEqual([d.hud?.score]);
    expect(sent[0]).toBeGreaterThan(0);
    pressed(d, 'select', on);
    expect(sent).toHaveLength(1);
  });

  it('sends the score reached on B on a ready screen once play has started, once, and stays on the game over', () => {
    const { sent, on } = arcade();
    const d = untilHit(pressed(opened(), 'start', on), on);
    expect(d.hud).toMatchObject({ phase: 'ready', lives: 2, started: true });
    const over = pressed(d, 'b', on);
    expect(over.hud?.phase).toBe('over');
    expect(sent).toEqual([0]);
    expect(pressedDuet(over, 'b', on)).toBe('back');
    expect(sent).toHaveLength(1);
  });

  it('sends nothing on B on the first ready screen', () => {
    const { sent, on } = arcade();
    expect(pressedDuet(opened(), 'b', on)).toBe('back');
    expect(sent).toEqual([]);
  });

  it('begins again on A at the game over, which sends the next game\'s score once more', () => {
    const { sent, on, again } = arcade();
    let d = pressed(pressed(pressed(opened(), 'start', on), 'start', on), 'select', on);
    d = pressed(d, 'a', on);
    expect(again()).toBe(1);
    expect(d.hud).toMatchObject({ phase: 'ready', started: false, score: 0, lives: 3 });
    d = pressed(pressed(pressed(d, 'start', on), 'start', on), 'select', on);
    expect(sent).toEqual([0, 0]);
  });
});
