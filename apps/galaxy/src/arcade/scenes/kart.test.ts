import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '../keys';
import { gridFor, TALL, WIDE, type Grid } from '../grid';
import { ScreenContext } from '../Screen';
import { DEFAULT_THEME } from '../theme';
import { LAPS } from '../kart/track';
import { markFor } from '../mark';
import { drawFrame } from './index.ts';
import { setFleets } from '../fleets';
import type { FleetRow } from '../types';
import { BACK_TO_CHOICE, BACK_TO_OPTIONS, choicePress, KEY_RESERVED, OPTIONS_OPEN, PRESS_A_KEY, FIRST_CHOICE, GRID_OUT_LINE, gridPress, type KartGridView, MULTI_CLOSED_LINE, kartCast, kartPress, loadKart, circuitName, circuitPress, type CircuitCard, NOT_LOADED, kartEngineLevel, kartEngineOn, kartSong, raceTime, PAGES, PAUSED_LINE, READY_LINE, readyLine, sameKartHud, soundOf, TALL_SCENES, type KartCue, type KartGame, type KartItem, type KartChoice, type KartHud, type KartStatus } from './kart.ts';
import { KartOverlay, type KartArt } from './kart.tsx';
import type { FrameState, KartDraw } from './common.ts';
import { defaultOptions, optionsKey, optionsPress, type OptionsView } from '../kart/options';
import { sending, type ScoreSend } from './invaders-score';

// OMNI KART's text layer and scene (PRD 1359, slice 1): the loading and failure lines, the ready
// screen, the loader and what a press does before the race.

const text = (status: KartStatus, grid: Grid = WIDE, form: 'full' | 'handheld' = 'full', hud: KartHud | null = null) =>
  renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid, page: 0, pages: 1 } }, createElement(KartOverlay, { status, hud })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** A game that does nothing, as the loader hands it over. */
const stubGame = (): KartGame => ({ draw: () => {}, ready: () => Promise.resolve(), step: () => null, press: () => ({ quit: false, again: false }), pause: () => {}, away: () => {}, close: () => {}, hud: () => ({ phase: 'ready', beat: null }), cues: () => [], speed: () => 0, skid: () => 0, board: 'kart' });

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

  it('names the player\'s laps on the ready screen and before the choice', () => {
    expect(readyLine(5)).toBe('COMET RING · 5 LAPS · PRESS START');
    const five = { ...defaultOptions(), laps: 5 as const };
    const render = (choice: KartChoice | null) => renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', choice, options: five })))
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(render({ step: 'single' })).toBe('COMET RING · 5 LAPS · PRESS START B GAME ROOM');
    expect(render(FIRST_CHOICE)).toContain('COMET RING · 5 LAPS ▶ SINGLE');
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

  it('hands the game the laps and difficulty of the options', async () => {
    const createKart = vi.fn(() => stubGame());
    await loadKart(() => Promise.resolve({ createKart }), 42, [], { laps: 5, difficulty: 'hard', look: { color: 'FLEET', design: 'CLASSIC' }, track: 'comet-ring' });
    expect(createKart).toHaveBeenCalledWith({ seed: 42, cast: [], laps: 5, difficulty: 'hard', look: { color: 'FLEET', design: 'CLASSIC' }, circuit: 'comet-ring' });
  });

  it('hands the game the look of the options', async () => {
    const createKart = vi.fn(() => stubGame());
    await loadKart(() => Promise.resolve({ createKart }), 42, [], { laps: 3, difficulty: 'normal', look: { color: 'PINK', design: 'RACER' }, track: 'comet-ring' });
    expect(createKart).toHaveBeenCalledWith({ seed: 42, cast: [], laps: 3, difficulty: 'normal', look: { color: 'PINK', design: 'RACER' }, circuit: 'comet-ring' });
  });

  it('hands the game the circuit of the options (PRD 1923)', async () => {
    const createKart = vi.fn(() => stubGame());
    await loadKart(() => Promise.resolve({ createKart }), 42, [], { laps: 3, difficulty: 'normal', look: { color: 'FLEET', design: 'CLASSIC' }, track: 'frost-eight' });
    expect(createKart).toHaveBeenCalledWith(expect.objectContaining({ circuit: 'frost-eight' }));
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
  const results = (): KartHud => ({ phase: 'finish', beat: null, results: { rows, place: 1, tenths: 1000, threeLap: 1000 } });
  const sendOf = (s: ScoreSend | null) => renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: results(), send: s })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('lists the six places, each driver and their time, with -- for a kart still racing, on both grids', () => {
    const t = text('ready', WIDE, 'full', results());
    expect(t).toContain('RESULTS 1ST YOU 1:40.0 2ND ALPHA 1:42.5 3RD BRAVO 1:45.0 4TH CHARLIE -- 5TH DELTA -- 6TH ECHO --');
    expect(text('ready', TALL, 'handheld', results())).toContain('6TH ECHO --');
    expect(t).toContain('3-LAP TIME 1:40.0');
  });

  it('says the time sent is the three-lap one when the race was longer', () => {
    const long: KartHud = { phase: 'finish', beat: null, results: { rows, place: 1, tenths: 1700, threeLap: 1000 } };
    expect(text('ready', WIDE, 'full', long)).toContain('3-LAP TIME 1:40.0');
  });

  it('fills a MULTI table in live: the time of whoever finished, a dash for whoever races, OUT for whoever left', () => {
    const live = (): KartHud => ({ phase: 'finish', beat: null, results: { rows: [
      { place: 1, name: 'YOU', tenths: 1000, you: true }, { place: 2, name: 'ALPHA', tenths: 1042, you: false },
      { place: 3, name: 'BRAVO', tenths: null, you: false }, { place: 4, name: 'CHARLIE', tenths: null, you: false, out: true },
    ], place: 1, tenths: 1000, threeLap: 1000, live: true } });
    expect(text('ready', WIDE, 'full', live())).toContain('RESULTS 1ST YOU 1:40.0 2ND ALPHA 1:44.2 3RD BRAVO — -- CHARLIE OUT');
    expect(sameKartHud(live(), live())).toBe(true);
    const first = live();
    const later = live();
    if (first.results && later.results) later.results = { ...first.results, rows: first.results.rows.map((r) => (r.name === 'BRAVO' ? { ...r, tenths: 1100 } : r)) };
    expect(sameKartHud(first, later)).toBe(false);
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

describe('the sounds of the drift (PRD 1963)', () => {
  it('maps the ticks, the whoosh and the sputter to their own effects beside the player', () => {
    expect(soundOf({ kind: 'tick', color: 'blue' })).toEqual({ sfx: 'tickBlue', far: 0 });
    expect(soundOf({ kind: 'tick', color: 'orange' })).toEqual({ sfx: 'tickOrange', far: 0 });
    expect(soundOf({ kind: 'whoosh' })).toEqual({ sfx: 'whoosh', far: 0 });
    expect(soundOf({ kind: 'sputter' })).toEqual({ sfx: 'sputter', far: 0 });
  });

  it('revs the engine while GAS is held in the countdown, and follows the speed otherwise', () => {
    const hud = (phase: KartHud['phase']): KartHud => ({ phase, beat: null });
    const gas = new Set<Action>(['a']), none = new Set<Action>();
    expect(kartEngineLevel(hud('countdown'), 0, none)).toBe(0);
    expect(kartEngineLevel(hud('countdown'), 0, gas)).toBeGreaterThan(0.5);
    expect(kartEngineLevel(hud('race'), 0.3, gas)).toBe(0.3);
    expect(kartEngineLevel(hud('ready'), 0, gas)).toBeNull();
    expect(kartEngineLevel(null, 0, gas)).toBeNull();
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

describe('the choice on the ready screen (PRD 1572)', () => {
  const choose = (choice: KartChoice, multi: boolean) =>
    renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: null, choice, multi })))
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('shows the circuit, then SINGLE, MULTI and OPTIONS, the cursor on SINGLE', () => {
    expect(choose(FIRST_CHOICE, true)).toBe('COMET RING · 3 LAPS ▶ SINGLE MULTI OPTIONS B GAME ROOM');
  });
  it('reads MULTI · SIGN IN TO RACE without a link, and the cursor skips it', () => {
    expect(choose(FIRST_CHOICE, false)).toContain(MULTI_CLOSED_LINE);
    expect(choicePress(FIRST_CHOICE, 'down', false)).toEqual(BACK_TO_OPTIONS);
  });
  it('moves with up and down, and picks SINGLE with A or START', () => {
    const multi = choicePress(FIRST_CHOICE, 'down', true);
    expect(multi).toEqual({ step: 'choose', cursor: 'multi' });
    expect(choicePress(multi, 'up', true)).toEqual(FIRST_CHOICE);
    expect(choicePress(FIRST_CHOICE, 'a', true)).toEqual({ step: 'circuit', then: 'single' });
    expect(choicePress(FIRST_CHOICE, 'start', true)).toEqual({ step: 'circuit', then: 'single' });
  });
  it('moves the cursor over the three lines and stops at the ends', () => {
    const multi: KartChoice = { step: 'choose', cursor: 'multi' };
    expect(choicePress(multi, 'down', true)).toEqual(BACK_TO_OPTIONS);
    expect(choicePress(BACK_TO_OPTIONS, 'down', true)).toBe(BACK_TO_OPTIONS);
    expect(choicePress(BACK_TO_OPTIONS, 'up', true)).toEqual(multi);
    expect(choicePress(FIRST_CHOICE, 'up', true)).toBe(FIRST_CHOICE);
  });
  it('opens the OPTIONS panel on A or START at OPTIONS', () => {
    expect(choicePress(BACK_TO_OPTIONS, 'a', true)).toEqual(OPTIONS_OPEN);
    expect(choicePress(BACK_TO_OPTIONS, 'start', false)).toEqual(OPTIONS_OPEN);
  });
  it('picking SINGLE shows today\'s ready line', () => {
    expect(choose({ step: 'single' }, true)).toContain(READY_LINE);
  });
  it('B goes back to the game room', () => {
    expect(kartPress('ready', 'b', 'ready')).toBe('back');
  });
});

const CARDS: readonly CircuitCard[] = [
  { id: 'comet-ring', name: 'COMET RING', board: 'kart', cols: 4, rows: 4, ground: '#07061c', runs: [{ x: 0, y: 0, w: 4, colour: '#8090d0' }] },
  { id: 'frost-eight', name: 'FROST EIGHT', board: 'kart-frost-eight', cols: 4, rows: 4, ground: '#eef4fa', runs: [{ x: 1, y: 1, w: 2, colour: '#a6dcf2' }] },
];

describe('the CIRCUIT step (PRD 1923)', () => {
  const step = (then: 'single' | 'grid', track: string, bests: Record<string, number | null> = {}, grid: Grid = WIDE) =>
    renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: null, choice: { step: 'circuit', then }, multi: true, options: { ...defaultOptions(), track }, circuit: { cards: CARDS, bests } })))
      .replace(/<svg.*?<\/svg>/g, ' [MAP] ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const ids = CARDS.map((c) => c.id);
  const here: Extract<KartChoice, { step: 'circuit' }> = { step: 'circuit', then: 'single' };

  it('comes after SINGLE and after MULTI', () => {
    expect(choicePress(FIRST_CHOICE, 'a', true)).toEqual(here);
    expect(choicePress({ step: 'choose', cursor: 'multi' }, 'a', true)).toEqual({ step: 'circuit', then: 'grid' });
  });
  it('names the circuit kept between ◀ and ▶, with its minimap and its best, and the hint', () => {
    expect(step('single', 'frost-eight', { 'frost-eight': 983 })).toBe('CIRCUIT ◀ FROST EIGHT ▶ [MAP] BEST 1:38.3 ◀ ▶ CHOOSE · A RACE · B BACK');
    expect(step('single', 'comet-ring')).toBe('CIRCUIT ◀ COMET RING ▶ [MAP] NO TIME YET ◀ ▶ CHOOSE · A RACE · B BACK');
  });
  it('says A GRID after MULTI, and draws the same on the tall grid', () => {
    expect(step('grid', 'comet-ring')).toContain('A GRID');
    expect(step('single', 'frost-eight', {}, TALL)).toContain('FROST EIGHT');
  });
  it('draws a 72 px minimap of the circuit', () => {
    const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: null, choice: here, options: { ...defaultOptions(), track: 'frost-eight' }, circuit: { cards: CARDS, bests: {} } })));
    expect(html).toContain('width="72"');
    expect(html).toContain('data-circuit="frost-eight"');
    expect(html).toContain('#a6dcf2');
  });
  it('moves between the two circuits with ◀ ▶, in both directions', () => {
    expect(circuitPress(here, 'right', 'comet-ring', ids).track).toBe('frost-eight');
    expect(circuitPress(here, 'left', 'comet-ring', ids).track).toBe('frost-eight');
    expect(circuitPress(here, 'left', 'frost-eight', ids).track).toBe('comet-ring');
    expect(circuitPress(here, 'up', 'comet-ring', ids)).toEqual({ choice: here, track: 'comet-ring' });
  });
  it('races on A or START after SINGLE, goes to the grid after MULTI, and goes back on B', () => {
    expect(circuitPress(here, 'a', 'frost-eight', ids)).toEqual({ choice: { step: 'single' }, track: 'frost-eight' });
    expect(circuitPress(here, 'start', 'frost-eight', ids).choice).toEqual({ step: 'single' });
    expect(circuitPress({ step: 'circuit', then: 'grid' }, 'a', 'comet-ring', ids).choice).toEqual({ step: 'grid' });
    expect(circuitPress(here, 'b', 'comet-ring', ids).choice).toEqual(FIRST_CHOICE);
    expect(circuitPress({ step: 'circuit', then: 'grid' }, 'b', 'comet-ring', ids).choice).toEqual({ step: 'choose', cursor: 'multi' });
  });
  it('opens on the circuit kept: a track the cards do not hold reads as the first', () => {
    expect(step('single', 'nowhere')).toContain('COMET RING');
  });
  it('names the circuit kept on the choice, the ready title and the ready line', () => {
    expect(readyLine(3, 'FROST EIGHT')).toBe('FROST EIGHT · 3 LAPS · PRESS START');
    const render = (choice: KartChoice) => renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', choice, options: { ...defaultOptions(), track: 'frost-eight' }, circuit: { cards: CARDS, bests: {} } }))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(render({ step: 'single' })).toBe('FROST EIGHT · 3 LAPS · PRESS START B GAME ROOM');
    expect(render(FIRST_CHOICE)).toContain('FROST EIGHT · 3 LAPS ▶ SINGLE');
  });
  it('names it before the cards have loaded, from its id', () => {
    expect(circuitName([], 'frost-eight')).toBe('FROST EIGHT');
    expect(circuitName(CARDS, 'comet-ring')).toBe('COMET RING');
  });
  it('shows the grid its circuit\'s name', () => {
    const view: KartGridView = { state: 'joined', rows: [], line: 'START RACE', laps: 3, track: 'frost-eight' };
    const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: null, choice: { step: 'grid' }, multi: true, lobby: view, circuit: { cards: CARDS, bests: {} } })));
    expect(html).toContain('GRID · FROST EIGHT · 3 LAPS');
  });
});

describe('the grid (PRD 1572)', () => {
  const hero = { v: 1, body: 'girl', skin: 0, hair: 0, suit: 0, cape: 0 } as const;
  const row = (id: string, name: string, best: number | null, you = false, seat = true) => ({ id, name, hero, fleet: null, best, you, seat });
  const grid = (view: KartGridView) =>
    renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: null, choice: { step: 'grid' }, multi: true, lobby: view })))
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('picking MULTI with A or START goes to the grid, and only when it can be picked', () => {
    const onMulti: KartChoice = { step: 'choose', cursor: 'multi' };
    expect(choicePress(onMulti, 'a', true)).toEqual({ step: 'circuit', then: 'grid' });
    expect(choicePress(onMulti, 'start', true)).toEqual({ step: 'circuit', then: 'grid' });
    expect(choicePress(onMulti, 'a', false)).toBe(onMulti);
  });

  it("lists each player's name and best time or NO TIME, in the order it is given, with the line under them", () => {
    const view: KartGridView = { state: 'joined', rows: [row('a', 'Ada', 653), row('b', 'Bo', null, true)], line: 'WAITING FOR ADA' };
    expect(grid(view)).toBe('GRID Ada 1:05.3 Bo NO TIME WAITING FOR ADA B BACK');
  });

  it("titles the grid with the laps it will run, and draws each kart in its look (PRD 1762)", () => {
    const view: KartGridView = { state: 'joined', rows: [row('a', 'Ada', 653)], line: 'WAITING FOR RACERS', laps: 5 };
    expect(grid(view)).toContain('GRID · 5 LAPS');
    const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: null, choice: { step: 'grid' }, multi: true, lobby: view, kartOf: () => ({ sprite: () => 'kart-rocket', tint: {} }) })));
    expect(html).toContain('ADA&#x27;S KART');
  });

  it('says each line of the grid as it is given', () => {
    for (const line of ['WAITING FOR RACERS', 'START RACE', 'WAITING FOR ADA', 'GRID FULL · 4 RACERS', 'RECONNECTING…', GRID_OUT_LINE]) {
      expect(grid({ state: 'joined', rows: [row('a', 'Ada', null, true)], line })).toContain(line);
    }
  });

  it('shows the joining line before the grid says anything', () => {
    const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: null, choice: { step: 'grid' }, multi: true })));
    expect(html).toContain('JOINING THE GRID…');
  });

  it('goes back to the choice with B, the cursor on MULTI; A tries again only once the grid was out of reach', () => {
    const view = (state: KartGridView['state']): KartGridView => ({ state, rows: [], line: '' });
    expect(gridPress(view('joined'), 'b')).toBe('back');
    expect(BACK_TO_CHOICE).toEqual({ step: 'choose', cursor: 'multi' });
    expect(gridPress(view('out'), 'a')).toBe('retry');
    for (const state of ['joining', 'reconnecting'] as const) expect(gridPress(view(state), 'a'), state).toBeNull();
    expect(gridPress(null, 'a')).toBeNull();
    expect(gridPress(view('out'), 'start')).toBeNull();
  });

  it('asks to start the race with A or START once joined (the grid says whether this player may)', () => {
    const view = (state: KartGridView['state']): KartGridView => ({ state, rows: [], line: '' });
    expect(gridPress(view('joined'), 'a')).toBe('start');
    expect(gridPress(view('joined'), 'start')).toBe('start');
    expect(gridPress(view('joining'), 'start')).toBeNull();
    expect(gridPress(view('reconnecting'), 'start')).toBeNull();
  });
});

describe('the live race on the text layer (PRD 1572, slice 4)', () => {
  const run = { place: 2, lap: 1, laps: 3, tenths: 123, final: false, item: null } as const;
  const text = (hud: KartHud) => renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud, choice: { step: 'live' }, multi: true })))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('shows the place among the players, the lap and the time on the race line', () => {
    const t = text({ phase: 'race', beat: null, menu: false, run });
    expect(t).toContain('2ND');
    expect(t).toContain('LAP 1/3');
    expect(t).toContain('0:12.3');
    expect(t).not.toContain('BACK TO RACE');
  });

  it('opens BACK TO RACE and LEAVE RACE over the race with ENTER and TAB', () => {
    const t = text({ phase: 'race', beat: null, menu: true, run });
    expect(t).toContain('BACK TO RACE');
    expect(t).toContain('LEAVE RACE');
    expect(t).toContain('LAP 1/3');
  });

  it('says YOU LEFT THE RACE with A for the grid', () => {
    const t = text({ phase: 'left', beat: null });
    expect(t).toContain('YOU LEFT THE RACE');
    expect(t).toContain('GRID');
  });

  it('keeps the PAUSE hint in a SINGLE race, and the music and engine off once the player left', () => {
    expect(text({ phase: 'race', beat: null, run })).toContain('PAUSE');
    expect(kartSong({ phase: 'left', beat: null })).toBeNull();
    expect(kartEngineOn({ phase: 'left', beat: null })).toBe(false);
  });

  it('tells a menu opening from the same race without it', () => {
    expect(sameKartHud({ phase: 'race', beat: null, menu: false, run }, { phase: 'race', beat: null, menu: true, run })).toBe(false);
    expect(sameKartHud({ phase: 'race', beat: null, menu: true, run }, { phase: 'race', beat: null, menu: true, run: { ...run } })).toBe(true);
  });

  it('shows the grid, not the loading line, while the single game loads again behind it', () => {
    const html = renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'loading', hud: null, choice: { step: 'grid' }, multi: true })));
    expect(html).toContain('JOINING THE GRID…');
    expect(html).not.toContain('LOADING…');
  });
});

describe('the OPTIONS panel (PRD 1762)', () => {
  const panel = (view: OptionsView, options = defaultOptions(), form: 'full' | 'handheld' = 'full') =>
    renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: null, choice: { step: 'options', view }, multi: true, options })))
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('lists KEYS ›, KART ›, LAPS, DIFFICULTY and DEFAULTS, with the cursor on KEYS and B to go back', () => {
    expect(panel(OPTIONS_OPEN.step === 'options' ? OPTIONS_OPEN.view : { screen: 'menu', cursor: 'keys' })).toBe('OPTIONS ▶ KEYS › KART › LAPS ◀ 3 ▶ DIFFICULTY ◀ NORMAL ▶ DEFAULTS B BACK');
  });

  it('shows what changed: LAPS 5, DIFFICULTY HARD', () => {
    const view: OptionsView = { screen: 'menu', cursor: 'laps' };
    const options = { ...defaultOptions(), laps: 5 as const, difficulty: 'hard' as const };
    expect(panel(view, options)).toContain('▶ LAPS ◀ 5 ▶ DIFFICULTY ◀ HARD ▶');
  });

  it('moves, changes a value and puts DEFAULTS back, from the ready screen\'s press to the panel\'s', () => {
    let view: OptionsView = { screen: 'menu', cursor: 'keys' };
    let options = defaultOptions();
    for (const a of ['down', 'down', 'right', 'down', 'right', 'right'] as const) ({ view, options } = optionsPress(view, options, a));
    expect(options).toMatchObject({ laps: 5, difficulty: 'easy' });
    for (const a of ['down', 'a'] as const) ({ view, options } = optionsPress(view, options, a));
    expect(options).toEqual(defaultOptions());
  });

  it('lists the six actions with their keys, HOP last, and says PRESS A KEY while it waits', () => {
    const keys: OptionsView = { screen: 'keys', cursor: 'gas', capture: false, refused: false };
    expect(panel(keys)).toBe('KEYS ▶ GAS ▲ BRAKE ▼ LEFT ◀ RIGHT ▶ ITEM SHIFT HOP SPACE A CHANGE B BACK');
    expect(panel({ ...keys, capture: true })).toContain(`▶ GAS ${PRESS_A_KEY} BRAKE ▼`);
  });

  it('says KEY USED BY THE ARCADE after a reserved key, and keeps waiting', () => {
    const waiting: OptionsView = { screen: 'keys', cursor: 'gas', capture: true, refused: false };
    const { view } = optionsKey(waiting, defaultOptions(), 'Tab');
    expect(panel(view)).toContain(KEY_RESERVED);
    expect(KEY_RESERVED).toBe('KEY USED BY THE ARCADE');
  });

  it('shows a key the player bound', () => {
    const { options } = optionsKey({ screen: 'keys', cursor: 'gas', capture: true, refused: false }, defaultOptions(), 'w');
    expect(panel({ screen: 'keys', cursor: 'gas', capture: false, refused: false }, options)).toContain('GAS W');
  });

  it('goes back from the panel to the ready screen, the cursor on OPTIONS', () => {
    expect(optionsPress({ screen: 'menu', cursor: 'keys' }, defaultOptions(), 'b').leave).toBe(true);
    expect(BACK_TO_OPTIONS).toEqual({ step: 'choose', cursor: 'options' });
  });
});

describe('the race names the player\'s keys (PRD 1762)', () => {
  const race = (hud: KartHud, options = defaultOptions(), form: 'full' | 'handheld' = 'full') =>
    renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form, grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud, options })))
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('shows the keys on the countdown, default and own', () => {
    expect(race({ phase: 'countdown', beat: '3' })).toContain('▲ GAS ◀ ▶ STEER ▼ BRAKE SPACE HOP SHIFT ITEM');
    const own = { ...defaultOptions(), keys: { gas: 'w', brake: 's', left: 'a', right: 'd', item: 'e', hop: 'q' } };
    expect(race({ phase: 'countdown', beat: '3' }, own)).toContain('W GAS A D STEER S BRAKE Q HOP E ITEM');
  });

  it('shows no keys line on the Game Boy, whose pad keeps A and B, nor once the race is on', () => {
    expect(race({ phase: 'countdown', beat: '3' }, defaultOptions(), 'handheld')).not.toContain('GAS');
    expect(race({ phase: 'race', beat: null, run: { place: 1, lap: 1, laps: 3, tenths: 0, final: false, item: null } })).not.toContain('STEER');
  });

  it('names the ITEM key on the item panel, empty or holding one', () => {
    const run = (item: KartItem | null) => race({ phase: 'race', beat: null, run: { place: 1, lap: 1, laps: 3, tenths: 12, final: false, item } });
    expect(run(null)).toContain('SHIFT');
    expect(run('boost')).toContain('SHIFT ITEM BOOST');
    const own = { ...defaultOptions(), keys: { ...defaultOptions().keys, item: 'e' } };
    expect(race({ phase: 'race', beat: null, run: { place: 1, lap: 1, laps: 3, tenths: 12, final: false, item: 'orb' } }, own)).toContain('E ITEM ORB');
  });
});

describe('the KART panel (PRD 1762)', () => {
  const panel = (view: OptionsView, options = defaultOptions(), art: KartArt | null = null) =>
    renderToStaticMarkup(createElement(ScreenContext.Provider, { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } }, createElement(KartOverlay, { status: 'ready', hud: null, choice: { step: 'options', view }, multi: true, options, art })));
  const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const art: KartArt = { sprite: (v) => (v === 'kart' ? 'kart-rocket' : `kart-rocket${v.slice(4)}`), tint: {} };

  it('lists COLOR, DESIGN and DEFAULTS with the look chosen', () => {
    const options = { ...defaultOptions(), look: { color: 'PINK', design: 'RACER' } };
    expect(text(panel({ screen: 'kart', cursor: 'color' }, options))).toBe('KART ▶ COLOR ◀ PINK ▶ DESIGN ◀ RACER ▶ DEFAULTS B BACK');
  });

  it('shows the kart in its look, a canvas that stays when motion is reduced', () => {
    expect(panel({ screen: 'kart', cursor: 'color' }, defaultOptions(), art)).toContain('aria-label="YOUR KART"');
    expect(panel({ screen: 'kart', cursor: 'color' })).not.toContain('YOUR KART');
  });
});
