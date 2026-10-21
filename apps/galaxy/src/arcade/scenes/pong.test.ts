import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { GAMES } from '../games';
import { cabinetDoor, cabinets, xpStatus } from '../games/room';
import { allowed } from '../onboarding';
import type { Session } from '../types';
import { at } from 'omni-loop/kit/lib/narrow.ts';
import { browserMic, createPong } from '../pong/index';
import { fakeMic, settle } from '../pong/mic.fake';
import { MATCH } from '../pong/rules';
import {
  livesLine, loadPong, LOADING_LINE, meterAt, meterBand, METER_SPAN, MIC_LOST, NOT_LOADED, PAGES, PONG_LIVES, pongPress, pongRetry, readyLines, samePongHud,
  TALL_SCENES, type ArcadePong, type MicState, type PongGame, type PongHud, type PongStatus,
} from './pong.ts';
import { PongOverlay } from './pong.tsx';
import { loadedPong, pausedPong, pongDrawOf, pressedPong, steppedPong, withPongHud, type PongHooks } from './pong.live';
import type { ScoreSend } from './invaders-score';

// OMNI PONG's scene (PRD 2101, slices 4 and 5): the cabinet that opens it, the loader, the loading and
// failure lines, the ready screen before and after the microphone, MIC REQUIRED and its reasons, the
// pitch meter's three states, the microphone stopped when the scene is left; then the match's HUD, the
// pause, MIC LOST, the game over and its score sent once, whichever way the match ended.

const READY: PongHud = { phase: 'ready', limit: 'MID', limitHz: 220, band: 10, mic: 'off', steer: 'still', hz: null, score: 0, lives: 3 };
const hudWith = (mic: MicState, more: Partial<PongHud> = {}): PongHud => ({ ...READY, mic, ...more });

const text = (status: PongStatus, hud: PongHud | null = READY, grid: Grid = WIDE, form: 'full' | 'handheld' = 'full') =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } }, createElement(PongOverlay, { status, hud })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** A game that counts what is asked of it, as the loader hands it over. */
function stubGame(hud: PongHud = READY, leave = false) {
  const calls = { press: [] as string[], pause: 0, close: 0, step: 0 };
  const game: PongGame = {
    draw: () => {}, step: () => { calls.step++; return { over: false }; }, press: (a) => { calls.press.push(a); return { leave: leave && a === 'b' }; },
    pause: () => { calls.pause++; }, close: () => { calls.close++; }, hud: () => hud,
  };
  return { game, calls };
}

const arcade = (game: PongGame | null, status: PongStatus = 'ready'): ArcadePong => ({ status, retry: 0, grid: WIDE, game, hud: game?.hud() ?? null });

describe('the cabinet', () => {
  const row = (level: number, unlocked: string[]) => ({ xp: 500, level, unlocked });

  it('names the pong scene in the registry\'s fifth row', () => {
    expect(GAMES[4]).toEqual({ id: 'pong', title: 'OMNI PONG', scene: 'pong', measure: 'points' });
  });

  it('opens the pong scene at LV 5, and still refuses it at LV 4', () => {
    const lv5 = xpStatus(true, row(5, ['invaders', 'platformer', 'kart', 'duet', 'pong']));
    expect(cabinetDoor(at(cabinets(lv5), 4, 'the fifth cabinet'), lv5)).toEqual({ scene: 'pong' });
    const lv4 = xpStatus(true, row(4, ['invaders', 'platformer', 'kart', 'duet']));
    expect(cabinetDoor(at(cabinets(lv4), 4, 'the fifth cabinet'), lv4)).toEqual({ refused: 'REACH LV 5 TO PLAY' });
  });

  it('is a signed-in scene: a signed-out player is bounced to INSERT COIN', () => {
    expect(allowed('pong', null)).toBe('coin');
    expect(allowed('pong', { crew: true } as unknown as Session)).toBe('pong');
  });

  it('is a held-buttons scene, as the other games are', () => {
    const app = readFileSync(new URL('../ArcadeApp.tsx', import.meta.url), 'utf8');
    expect(app).toMatch(/const HELD_SCENES[^\n]*'pong'/);
  });
});

describe('the pong scene on its grids', () => {
  it('is laid out tall, and takes one page', () => {
    expect(TALL_SCENES).toEqual(['pong']);
    expect(PAGES).toEqual({});
    expect(gridFor('handheld', 'pong')).toBe(TALL);
    expect(gridFor('full', 'pong')).toBe(WIDE);
  });
});

describe('the loader', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('makes the game with the browser\'s microphone once its code has come', async () => {
    const mic = fakeMic();
    const { game } = stubGame();
    const createPong = vi.fn(() => game);
    expect(await loadPong(() => Promise.resolve({ createPong, browserMic: () => mic }))).toBe(game);
    expect(createPong).toHaveBeenCalledWith({ mic });
  });

  it('hands the game the browser\'s microphone, which asks nothing until A', async () => {
    const game = await loadPong(() => Promise.resolve({ createPong, browserMic }));
    expect(game?.hud()).toMatchObject({ phase: 'ready', mic: 'off' });
  });

  it('answers null and logs it when the import fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadPong(() => Promise.reject(new Error('chunk gone')))).toBeNull();
    expect(logged).toHaveBeenCalledOnce();
  });

  it('A retries a failed import, B goes back while it loads or after it failed, and a loaded game takes every press', () => {
    expect(pongPress('failed', 'a')).toBe('retry');
    expect(pongPress('loading', 'a')).toBeNull();
    expect(pongPress('loading', 'b')).toBe('back');
    expect(pongPress('failed', 'b')).toBe('back');
    expect(pongPress('ready', 'b')).toBeNull();
    expect(pongPress('ready', 'start')).toBeNull();
  });
});

describe('the arcade\'s hold on the game', () => {
  it('holds the loaded game, or the failure; a game that loads after the scene closed is closed at once', () => {
    const { game, calls } = stubGame();
    const loading = arcade(null, 'loading');
    expect(loadedPong(loading, game)).toMatchObject({ status: 'ready', game, hud: READY });
    expect(loadedPong(loading, null)).toMatchObject({ status: 'failed', game: null, hud: null });
    expect(loadedPong(null, game)).toBeNull();
    expect(calls.close).toBe(1);
  });

  it('B with nothing open goes back; A after a failure loads again', () => {
    expect(pressedPong(null, 'b')).toBe('back');
    expect(pressedPong(null, 'a')).toBeNull();
    expect(pressedPong(arcade(null, 'failed'), 'a')).toMatchObject({ status: 'loading', retry: 1 });
  });

  it('hands every press to the loaded game, and closes it when it leaves', () => {
    const { game, calls } = stubGame(READY, true);
    const p = arcade(game);
    expect(pressedPong(p, 'left')).toBe(p);
    expect(pressedPong(p, 'b')).toBe('back');
    expect(calls.press).toEqual(['left', 'b']);
    expect(calls.close).toBe(1);
  });

  it('pauses the game from outside, and keeps the same state when its text layer says the same', () => {
    const { game, calls } = stubGame();
    const p = arcade(game);
    expect(pausedPong(p)).toBe(p);
    expect(calls.pause).toBe(1);
    expect(pausedPong(null)).toBeNull();
    expect(withPongHud({ ...p, hud: hudWith('on') }, game).hud).toEqual(READY);
  });

  it('draws the game only on its own scene', () => {
    const { game } = stubGame();
    expect(pongDrawOf('pong', arcade(game))).toBe(game);
    expect(pongDrawOf('games', arcade(game))).toBeNull();
    expect(pongDrawOf('pong', null)).toBeNull();
  });

  it('tells two text layers apart by every line they show', () => {
    expect(samePongHud(READY, { ...READY })).toBe(true);
    expect(samePongHud(null, null)).toBe(true);
    expect(samePongHud(READY, null)).toBe(false);
    for (const change of [{ phase: 'play' }, { limit: 'LOW' }, { limitHz: 160 }, { band: 5 }, { mic: 'on' }, { steer: 'up' }, { hz: 230 }, { score: 1 }, { lives: 2 }] as const) {
      expect(samePongHud(READY, { ...READY, ...change }), JSON.stringify(change)).toBe(false);
    }
  });
});

describe('the text layer', () => {
  it('reads LOADING… while the game comes, and the failure line with A to retry and B back', () => {
    expect(text('loading', null)).toBe(`${LOADING_LINE} B BACK`);
    expect(text('failed', null)).toBe(`${NOT_LOADED} B BACK`);
    expect(NOT_LOADED).toBe('GAME DID NOT LOAD · A TO RETRY');
  });

  it('reads the ready screen before the microphone: the title, the limit, how to steer and A to turn it on', () => {
    expect(text('ready', READY)).toBe('OMNI PONG ◀ PITCH · MID ▶ HIGH ▲ · LOW ▼ A · TURN ON MIC B BACK');
    expect(text('ready', hudWith('asking'))).toBe('OMNI PONG ◀ PITCH · MID ▶ HIGH ▲ · LOW ▼ A · TURN ON MIC B BACK');
    expect(text('ready', { ...READY, limit: 'HIGH', limitHz: 300 })).toContain('◀ PITCH · HIGH ▶');
  });

  it('reads the meter and START · PLAY once the microphone is on, the meter\'s sign as the steering reads', () => {
    expect(text('ready', hudWith('on', { steer: 'up', hz: 240 }))).toBe('OMNI PONG ◀ PITCH · MID ▶ ▲ START · PLAY B BACK');
    expect(text('ready', hudWith('on', { steer: 'still', hz: 221 }))).toContain('· START · PLAY');
    expect(text('ready', hudWith('on', { steer: 'down', hz: 180 }))).toContain('▼ START · PLAY');
  });

  it('reads MIC REQUIRED with its reason, A to ask again and B back, when refused, missing or insecure', () => {
    expect(text('ready', hudWith('blocked'))).toBe('OMNI PONG MIC REQUIRED MIC BLOCKED IN THE BROWSER A · ASK AGAIN B BACK');
    expect(text('ready', hudWith('missing'))).toBe('OMNI PONG MIC REQUIRED NO MIC FOUND A · ASK AGAIN B BACK');
    expect(readyLines(hudWith('missing')).kind).toBe('refused');
  });

  it('reads the same on the tall grid, and names the Game Boy\'s buttons there', () => {
    expect(text('ready', READY, TALL, 'handheld')).toBe('OMNI PONG ◀ PITCH · MID ▶ HIGH ▲ · LOW ▼ A · TURN ON MIC B BACK');
    expect(text('ready', hudWith('on'), TALL, 'handheld')).toContain('START · PLAY');
  });

  it('marks the heard pitch on the meter against the limit and its still band', () => {
    expect(meterAt(null, 220)).toBeNull();
    expect(meterAt(220, 220)).toBe(0.5);
    expect(meterAt(220 + METER_SPAN, 220)).toBe(1);
    expect(meterAt(40, 220)).toBe(0);
    expect(meterAt(1000, 220)).toBe(1);
    expect(meterBand(10)).toEqual({ left: 50 / 120, width: 10 / 60 });
    const html = renderToStaticMarkup(createElement(PongOverlay, { status: 'ready', hud: hudWith('on', { hz: 250, steer: 'up' }) }));
    expect(html).toContain('left:calc(75% - 3px)');
    expect(renderToStaticMarkup(createElement(PongOverlay, { status: 'ready', hud: hudWith('on') }))).not.toContain('pg-hz');
  });
});

describe('the ready screen, played', () => {
  it('turns the microphone on with A, shows the meter move with the voice, and stops it when the scene is left', async () => {
    const mic = fakeMic('on');
    const game = createPong({ mic, store: () => ({ getItem: () => null, setItem: () => {} }) });
    let p: ArcadePong | null = loadedPong(arcade(null, 'loading'), game);
    p = pressedPong(p, 'a') as ArcadePong;
    expect(p.hud?.mic).toBe('asking');
    await settle();
    mic.heard = 300;
    game.step(1 / 60);
    p = withPongHud(p, game);
    expect(text('ready', p.hud)).toContain('▲ START · PLAY');
    mic.heard = 150;
    game.step(1 / 60);
    expect(text('ready', withPongHud(p, game).hud)).toContain('▼ START · PLAY');
    expect(pressedPong(p, 'b')).toBe('back');
    expect(mic.on).toBe(false);
  });
});

const sent = (send: ScoreSend | null, hud: PongHud, grid: Grid = WIDE, form: 'full' | 'handheld' = 'full') =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } }, createElement(PongOverlay, { status: 'ready', hud, send })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the match on the text layer', () => {
  const playing: PongHud = { ...READY, phase: 'play', mic: 'on', score: 4, lives: 2 };

  it('shows the score, a heart for each life left and a dot for each one lost, and how to pause', () => {
    expect(PONG_LIVES).toBe(MATCH.lives);
    expect(livesLine(3)).toBe('♥♥♥');
    expect(livesLine(1)).toBe('♥··');
    expect(livesLine(0)).toBe('···');
    expect(text('ready', playing)).toBe('SCORE 4 ♥♥· ENTER PAUSE');
    expect(text('ready', playing, TALL, 'handheld')).toBe('SCORE 4 ♥♥· START PAUSE');
  });

  it('reads PAUSED with the key to resume and the key to quit, and the microphone\'s refusal when resuming was refused', () => {
    const paused: PongHud = { ...playing, phase: 'paused', mic: 'off' };
    expect(text('ready', paused)).toBe('SCORE 4 ♥♥· PAUSED ENTER · RESUME TAB · QUIT');
    expect(text('ready', paused, TALL, 'handheld')).toBe('SCORE 4 ♥♥· PAUSED START · RESUME SELECT · QUIT');
    expect(text('ready', { ...paused, mic: 'blocked' })).toBe('SCORE 4 ♥♥· PAUSED MIC BLOCKED IN THE BROWSER ENTER · RESUME TAB · QUIT');
    expect(text('ready', { ...paused, mic: 'missing' })).toContain('NO MIC FOUND');
  });

  it('reads MIC LOST · A TO RETRY when the microphone stopped during the match', () => {
    expect(MIC_LOST).toBe('MIC LOST · A TO RETRY');
    expect(text('ready', { ...playing, phase: 'lost', mic: 'off' }, TALL, 'handheld')).toBe('SCORE 4 ♥♥· MIC LOST · A TO RETRY A · RETRY SELECT · QUIT');
  });

  it('reads GAME OVER, the score, then saving, NEW BEST, the best, or not saved with A to retry', () => {
    const over: PongHud = { ...playing, phase: 'over', lives: 0 };
    expect(sent(null, over)).toBe('GAME OVER SCORE 4 A · AGAIN B · ROOM');
    expect(sent({ state: 'sending', score: 4, tries: 1 }, over)).toBe('GAME OVER SCORE 4 SAVING SCORE… A · AGAIN B · ROOM');
    expect(sent({ state: 'saved', score: 4, best: 4, newBest: true }, over)).toContain('NEW BEST');
    expect(sent({ state: 'saved', score: 4, best: 9, newBest: false }, over)).toContain('YOUR BEST 9');
    expect(sent({ state: 'failed', score: 4, tries: 1 }, over)).toBe('GAME OVER SCORE 4 SCORE NOT SAVED A · RETRY B · ROOM');
    expect(sent({ state: 'failed', score: 4, tries: 2 }, over)).toContain('A · AGAIN');
  });

  it('lets A retry a failed send on the game over only, while a retry is left', () => {
    const over: PongHud = { ...playing, phase: 'over' };
    const failed: ScoreSend = { state: 'failed', score: 4, tries: 1 };
    expect(pongRetry(over, failed, 'a')).toBe(true);
    expect(pongRetry(over, failed, 'b')).toBe(false);
    expect(pongRetry(over, { ...failed, tries: 2 }, 'a')).toBe(false);
    expect(pongRetry(playing, failed, 'a')).toBe(false);
    expect(pongRetry(null, failed, 'a')).toBe(false);
  });
});

describe('the score, sent once', () => {
  /** A match on a real game with a fake microphone, its START pressed, and the scores the arcade was handed. */
  async function match(heard: number | null) {
    const mic = fakeMic('on');
    const game = createPong({ mic, store: () => ({ getItem: () => null, setItem: () => {} }), seed: () => 11 });
    const scores: number[] = [];
    let again = 0;
    const on: PongHooks = { over: (s) => { scores.push(s); }, again: () => { again++; } };
    let p = loadedPong(arcade(null, 'loading'), game) as ArcadePong;
    p = pressedPong(p, 'a', on) as ArcadePong;
    await settle();
    mic.heard = heard;
    p = pressedPong(p, 'start', on) as ArcadePong;
    return { mic, game, scores, on, p, again: () => again };
  }

  it('is sent once when the third point is conceded, never again however long the frames run', async () => {
    const m = await match(1000);
    let p = m.p;
    for (let i = 0; i < 300 * 60; i++) p = steppedPong(p, m.game, 1 / 60, m.on);
    expect(p.hud?.phase).toBe('over');
    expect(m.scores).toEqual([p.hud?.score]);
  });

  it('is sent once on SELECT · QUIT from the pause, and not again on another SELECT or a frame', async () => {
    const m = await match(null);
    let p = pressedPong(m.p, 'start', m.on) as ArcadePong;
    expect(p.hud?.phase).toBe('paused');
    p = pressedPong(p, 'select', m.on) as ArcadePong;
    p = pressedPong(p, 'select', m.on) as ArcadePong;
    p = steppedPong(p, m.game, 1 / 60, m.on);
    expect(p.hud?.phase).toBe('over');
    expect(m.scores).toEqual([0]);
  });

  it('A on the game over plays again from the ready screen, and the next match sends its own score', async () => {
    const m = await match(null);
    let p = pressedPong(m.p, 'start', m.on) as ArcadePong;
    p = pressedPong(p, 'select', m.on) as ArcadePong;
    p = pressedPong(p, 'a', m.on) as ArcadePong;
    expect(m.again()).toBe(1);
    expect(p.hud).toMatchObject({ phase: 'ready', mic: 'off' }); // the pause had stopped it
    pressedPong(p, 'a', m.on);
    await settle();
    p = pressedPong(p, 'start', m.on) as ArcadePong;
    p = pressedPong(p, 'start', m.on) as ArcadePong;
    pressedPong(p, 'select', m.on);
    expect(m.scores).toEqual([0, 0]);
  });

  it('pauses the match from outside, and the microphone with it', async () => {
    const m = await match(null);
    const p = pausedPong(m.p);
    expect(p?.hud).toMatchObject({ phase: 'paused', mic: 'off' });
    expect(m.mic.on).toBe(false);
    expect(m.scores).toEqual([]);
  });
});
