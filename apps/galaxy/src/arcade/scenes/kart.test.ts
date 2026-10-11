import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { DEFAULT_THEME } from '../theme';
import { LAPS } from '../kart/track';
import { markFor } from '../mark';
import { drawFrame } from './index.ts';
import { setFleets } from '../fleets';
import type { FleetRow } from '../types';
import { kartCast, kartPress, loadKart, NOT_LOADED, kartEngineOn, kartSong, raceTime, PAGES, PAUSED_LINE, READY_LINE, sameKartHud, soundOf, TALL_SCENES, type KartCue, type KartGame, type KartItem, type KartHud, type KartStatus } from './kart.ts';
import { KartOverlay } from './kart.tsx';
import type { FrameState, KartDraw } from './common.ts';
import { sending, type ScoreSend } from './invaders-score';

// OMNI KART's text layer and scene (PRD 1359, slice 1): the loading and failure lines, the ready
// screen, the loader and what a press does before the race.

const text = (status: KartStatus, grid: Grid = WIDE, form: 'full' | 'handheld' = 'full', hud: KartHud | null = null) =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } }, createElement(KartOverlay, { status, hud })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** A game that does nothing, as the loader hands it over. */
const stubGame = (): KartGame => ({ draw: () => {}, step: () => null, press: () => ({ quit: false, again: false }), pause: () => {}, hud: () => ({ phase: 'ready', beat: null }), cues: () => [], speed: () => 0 });

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

  it('leaves B to the race once it began: the room is left from the pause', () => {
    for (const phase of ['countdown', 'race', 'paused'] as const) expect(kartPress('ready', 'b', phase), phase).toBeNull();
    expect(kartPress('ready', 'b', 'ready')).toBe('back');
  });

  it('reads nothing else yet: A while loading or ready, START, SELECT and the arrows', () => {
    for (const action of ['a', 'start', 'select', 'left', 'right', 'up', 'down'] as const) {
      expect(kartPress('loading', action), `loading ${action}`).toBeNull();
      expect(kartPress('ready', action), `ready ${action}`).toBeNull();
    }
    for (const action of ['start', 'select', 'left', 'right', 'up', 'down'] as const) expect(kartPress('failed', action), `failed ${action}`).toBeNull();
  });
});

describe('the race on the text layer', () => {
  const hud = (phase: KartHud['phase'], beat: KartHud['beat'] = null): KartHud => ({ phase, beat });

  it('shows the countdown number, on both grids', () => {
    for (const beat of ['3', '2', '1'] as const) {
      expect(text('ready', WIDE, 'full', hud('countdown', beat))).toBe(beat);
      expect(text('ready', TALL, 'handheld', hud('countdown', beat))).toBe(beat);
    }
    expect(renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: hud('countdown', '3') })))).toContain('role="status"');
  });

  it('shows GO as the race begins, with the way to pause', () => {
    expect(text('ready', WIDE, 'full', hud('race', 'GO'))).toBe('GO ENTER PAUSE');
    expect(text('ready', TALL, 'handheld', hud('race', 'GO'))).toBe('GO START PAUSE');
    expect(text('ready', WIDE, 'full', hud('race'))).toBe('ENTER PAUSE');
  });

  it('shows the pause with its two ways out: START resumes, SELECT goes back to the room', () => {
    expect(PAUSED_LINE).toBe('PAUSED');
    expect(text('ready', WIDE, 'full', hud('paused'))).toBe('PAUSED ENTER RESUME TAB GAME ROOM');
    expect(text('ready', TALL, 'handheld', hud('paused'))).toBe('PAUSED START RESUME SELECT GAME ROOM');
  });

  it('shows the ready screen again for a race that has not begun', () => {
    expect(text('ready', WIDE, 'full', hud('ready'))).toBe(text('ready'));
  });

  it('tells two text layers apart by their phase and their number', () => {
    expect(sameKartHud(null, null)).toBe(true);
    expect(sameKartHud(null, hud('ready'))).toBe(false);
    expect(sameKartHud(hud('countdown', '3'), hud('countdown', '3'))).toBe(true);
    expect(sameKartHud(hud('countdown', '3'), hud('countdown', '2'))).toBe(false);
    expect(sameKartHud(hud('race', 'GO'), hud('paused', 'GO'))).toBe(false);
  });
});

describe('loadKart', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('makes the game from the module it imports', async () => {
    const game = stubGame();
    expect(await loadKart(() => Promise.resolve({ createKart: () => game }))).toBe(game);
  });

  it('hands the game the seed it races from', async () => {
    const createKart = vi.fn(() => stubGame());
    await loadKart(() => Promise.resolve({ createKart }), 42);
    expect(createKart).toHaveBeenCalledWith({ seed: 42, cast: [] });
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
    const load = vi.fn<() => Promise<{ createKart: () => KartGame }>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ createKart: () => stubGame() });
    expect(await loadKart(load)).toBeNull();
    expect(await loadKart(load)).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('the kart canvas', () => {
  const calls: string[] = [];
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get: (target, prop) => (prop in target ? target[prop] : () => { calls.push(String(prop)); }),
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

describe('the race line of the text layer (slice 3)', () => {
  const run = (o: Partial<NonNullable<KartHud['run']>> = {}): KartHud => ({ phase: 'race', beat: null, run: { place: 3, lap: 2, laps: 3, tenths: 652, final: false, item: null, ...o } });

  it('shows the place, the lap and the race time over the road, on both grids, with the way to pause', () => {
    expect(text('ready', WIDE, 'full', run())).toBe('3RD LAP 2/3 1:05.2 ENTER PAUSE');
    expect(text('ready', TALL, 'handheld', run({ place: 1, lap: 1, tenths: 0 }))).toBe('1ST LAP 1/3 0:00.0 START PAUSE');
    expect(['1ST', '2ND', '3RD', '4TH', '5TH', '6TH'].map((_, i) => text('ready', WIDE, 'full', run({ place: i + 1 })).split(' ')[0])).toEqual(['1ST', '2ND', '3RD', '4TH', '5TH', '6TH']);
  });

  it('shows the item the player holds, and nothing while the hands are empty', () => {
    expect(text('ready', WIDE, 'full', run({ item: 'boost' }))).toBe('3RD LAP 2/3 1:05.2 ITEM BOOST ENTER PAUSE');
    expect(text('ready', WIDE, 'full', run({ item: 'orb' }))).toContain('ITEM ORB');
    expect(text('ready', WIDE, 'full', run())).not.toContain('ITEM');
    expect(sameKartHud(run({ item: 'blob' }), run({ item: null }))).toBe(false);
    expect(sameKartHud(run({ item: 'blob' }), run({ item: 'blob' }))).toBe(true);
  });

  it('shows FINAL LAP as the third lap starts, and only while racing', () => {
    expect(text('ready', WIDE, 'full', run({ lap: 3, final: true }))).toContain('FINAL LAP');
    expect(text('ready', WIDE, 'full', run({ lap: 3 }))).not.toContain('FINAL LAP');
    expect(text('ready', WIDE, 'full', { ...run({ lap: 3, final: true }), phase: 'paused' })).not.toContain('FINAL LAP');
  });

  it('keeps the race line on the pause', () => {
    expect(text('ready', WIDE, 'full', { ...run(), phase: 'paused' })).toContain('LAP 2/3');
  });

  it('tells two race lines apart by place, lap, time and the banner', () => {
    expect(sameKartHud(run(), run())).toBe(true);
    for (const o of [{ place: 4 }, { lap: 3 }, { laps: 4 }, { tenths: 653 }, { final: true }]) expect(sameKartHud(run(), run(o))).toBe(false);
    expect(sameKartHud(run(), { phase: 'race', beat: null })).toBe(false);
    expect(sameKartHud({ phase: 'race', beat: null }, { phase: 'race', beat: null })).toBe(true);
  });

  it('writes the race time as minutes, seconds and tenths', () => {
    expect([0, 9, 10, 599, 600, 652, 1799, -5].map(raceTime)).toEqual(['0:00.0', '0:00.9', '0:01.0', '0:59.9', '1:00.0', '1:05.2', '2:59.9', '0:00.0']);
  });
});

describe('the cast of the race', () => {
  const row = (name: string, mascot: string | null, color: string): FleetRow => ({ name, home: null, label: name.toUpperCase(), color, motto: '', mascot, sort: 0, retired: false });
  setFleets([row('alpha', 'beaver', '#ff0000'), row('bravo', 'octopod', '#00ff00'), row('charlie', null, '#0000ff')]);

  it('takes the workspace\'s fleets other than the player\'s own, each with its mascot and colour', () => {
    const cast = kartCast([{ name: 'alpha' }, { name: 'bravo' }, { name: 'charlie' }], 'bravo');
    expect(cast.map((c) => c.sprite).slice(0, 1)).toEqual(['beaver']);
    expect(cast).toHaveLength(2);
    expect(cast.map((c) => c.color)).toEqual(['#ff0000', '#0000ff']);
    expect(cast[1]?.sprite).not.toBe('octopod'); // a fleet with no mascot flies as a hero in its colour
    expect(cast[1]?.tint).toBeTruthy();
  });

  it('takes every fleet for a player flying solo, and never more than five', () => {
    expect(kartCast([{ name: 'alpha' }, { name: 'bravo' }], null)).toHaveLength(2);
    const seven = Array.from({ length: 7 }, (_, i) => ({ name: `f${i}` }));
    expect(kartCast(seven, null)).toHaveLength(5);
    expect(kartCast([], 'alpha')).toEqual([]);
  });

  it('hands the cast to the game with the seed', async () => {
    const createKart = vi.fn(() => stubGame());
    const cast = [{ sprite: 'beaver', tint: null, color: '#ff0000' }];
    await loadKart(() => Promise.resolve({ createKart }), 7, cast);
    expect(createKart).toHaveBeenCalledWith({ seed: 7, cast });
  });
});

describe('the results and the score (slice 4)', () => {
  const rows = ['YOU', 'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'].map((name, i) => ({ place: i + 1, name, tenths: i < 3 ? 1000 + i * 25 : null, you: i === 0 }));
  const results = (): KartHud => ({ phase: 'finish', beat: null, results: { rows, place: 1, tenths: 1000 } });
  const sendOf = (s: ScoreSend | null) => renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: results(), send: s })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('lists the six places, each driver and their time, with -- for a kart still racing, on both grids', () => {
    const t = text('ready', WIDE, 'full', results());
    expect(t).toContain('RESULTS 1ST YOU 1:40.0 2ND ALPHA 1:42.5 3RD BRAVO 1:45.0 4TH CHARLIE -- 5TH DELTA -- 6TH ECHO --');
    expect(text('ready', TALL, 'handheld', results())).toContain('6TH ECHO --');
    expect(t).toContain('TIME 1:40.0');
  });

  it('shows A to race again and B to the room when nothing is being retried', () => {
    expect(text('ready', WIDE, 'full', results())).toContain('A RACE AGAIN');
    expect(text('ready', WIDE, 'full', results())).toContain('GAME ROOM');
  });

  it('shows every state of the send: saving, NEW BEST, your best, not saved with a retry', () => {
    expect(sendOf(sending(1500))).toContain('SAVING TIME…');
    expect(sendOf({ state: 'saved', score: 1500, best: 1500, newBest: true })).toContain('NEW BEST');
    expect(sendOf({ state: 'saved', score: 1500, best: 1023, newBest: false })).toContain('YOUR BEST 1:42.3');
    const lost = sendOf({ state: 'failed', score: 1500, tries: 1 });
    expect(lost).toContain('TIME NOT SAVED');
    expect(lost).toContain('RETRY');
    expect(sendOf({ state: 'failed', score: 1500, tries: 2 })).toContain('RACE AGAIN');
  });

  it('goes back to the room on B from the results, and tells two results apart', () => {
    expect(kartPress('ready', 'b', 'finish')).toBe('back');
    expect(kartPress('ready', 'a', 'finish')).toBeNull();
    expect(sameKartHud(results(), results())).toBe(false);
    const r = results();
    expect(sameKartHud(r, r)).toBe(true);
  });
});

// What the race says becomes sound (PRD 1427, slice 2): every cue has an effect, a rival's is farther, and none is heard beyond 20 tiles.
describe('the sound of a cue', () => {
  const cues: KartCue[] = [
    { kind: 'beep', beat: '3' }, { kind: 'go' }, { kind: 'item', item: 'boost', you: true, tiles: 0 }, { kind: 'item', item: 'blob', you: true, tiles: 0 },
    { kind: 'item', item: 'orb', you: true, tiles: 0 }, { kind: 'box' }, { kind: 'hit', item: 'orb', you: true, tiles: 0 }, { kind: 'spin' }, { kind: 'fall' }, { kind: 'finalLap' },
  ];

  it('maps every cue to an effect beside the player', () => {
    expect(cues.map((c) => soundOf(c))).toEqual([
      { sfx: 'beep', far: 0 }, { sfx: 'go', far: 0 }, { sfx: 'boost', far: 0 }, { sfx: 'blob', far: 0 },
      { sfx: 'orb', far: 0 }, { sfx: 'box', far: 0 }, { sfx: 'impact', far: 0 }, { sfx: 'spin', far: 0 }, { sfx: 'fall', far: 0 }, { sfx: 'finalLap', far: 0 },
    ]);
  });

  it('gives each item its own sound', () => {
    const own = (item: KartItem) => soundOf({ kind: 'item', item, you: true, tiles: 0 })?.sfx;
    expect(new Set([own('boost'), own('blob'), own('orb')]).size).toBe(3);
  });

  it('plays a rival\'s item and a hit on a rival as the same effect, farther the farther it is', () => {
    const item = (tiles: number) => soundOf({ kind: 'item', item: 'orb', you: false, tiles });
    const hit = (tiles: number) => soundOf({ kind: 'hit', item: 'blob', you: false, tiles });
    expect(item(10)).toMatchObject({ sfx: 'orb' });
    expect(hit(10)).toMatchObject({ sfx: 'impact' });
    expect(item(10)?.far).toBeGreaterThan(item(3)?.far ?? 1);
    expect(item(3)?.far).toBeGreaterThan(0);
    expect(item(20)?.far).toBe(1);
    expect(item(0)?.far).toBeGreaterThan(0);
  });

  it('plays nothing for a rival beyond 20 tiles, and still plays the player\'s own, however far', () => {
    expect(soundOf({ kind: 'item', item: 'orb', you: false, tiles: 20.1 })).toBeNull();
    expect(soundOf({ kind: 'hit', item: 'orb', you: false, tiles: 40 })).toBeNull();
    expect(soundOf({ kind: 'hit', item: 'orb', you: true, tiles: 40 })).toEqual({ sfx: 'impact', far: 0 });
  });
});

describe('the race\'s music and engine (PRD 1427)', () => {
  const run = (final: boolean) => ({ place: 1, lap: final ? 3 : 1, laps: 3, tenths: 10, final, item: null });
  const hud = (phase: KartHud['phase'], extra: Partial<KartHud> = {}): KartHud => ({ phase, beat: null, ...extra });

  it('plays no song on the ready screen and during the countdown', () => {
    expect(kartSong(hud('ready'))).toBeNull();
    expect(kartSong(hud('countdown', { beat: '2' }))).toBeNull();
    expect(kartSong(null)).toBeNull();
  });

  it('plays race from GO and lastLap once FINAL LAP shows', () => {
    expect(kartSong(hud('race', { run: run(false) }))).toBe('race');
    expect(kartSong(hud('race', { run: run(true) }))).toBe('lastLap');
  });

  it('plays none while paused, and the fanfare on the results', () => {
    expect(kartSong(hud('paused', { run: run(true) }))).toBeNull();
    expect(kartSong(hud('finish'))).toBe('fanfare');
  });

  it('hums during the countdown and the race only', () => {
    expect(['ready', 'countdown', 'race', 'paused', 'finish'].map((p) => kartEngineOn(hud(p as KartHud['phase'])))).toEqual([false, true, true, false, false]);
    expect(kartEngineOn(null)).toBe(false);
  });
});
