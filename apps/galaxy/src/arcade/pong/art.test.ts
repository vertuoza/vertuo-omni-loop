import { describe, expect, it } from 'vitest';
import { TALL, WIDE, type FrameState } from '../scenes/common.ts';
import { DEFAULT_THEME } from '../theme';
import { createPong } from './art';
import { fakeMic, settle } from './mic.fake';
import { OPTIONS_KEY, type OptionsStore } from './options';
import { BAND_HZ, LIMITS, MATCH } from './rules';

// OMNI PONG's ready screen as the game holds it (PRD 2101): the limit set and kept, the microphone
// asked for once at a time, and the pitch meter's three states as the voice moves.

/** A browser's storage that keeps what it is given, across pages. */
function memory(): { store: () => OptionsStore; kept: Map<string, string> } {
  const kept = new Map<string, string>();
  return { kept, store: () => ({ getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => { kept.set(k, v); } }) };
}

async function micOn(heard: number | null = null, seed = 7) {
  const mic = fakeMic('on');
  const game = createPong({ mic, store: memory().store, seed: () => seed });
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

/** A canvas that keeps every rectangle filled, with its colour. */
function canvas() {
  const rects: [string, number, number, number, number][] = [];
  let fill = '';
  const ctx = {
    set fillStyle(c: string) { fill = c; },
    fillRect: (x: number, y: number, w: number, h: number) => { rects.push([fill, x, y, w, h]); },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

/** The top of the player's paddle as drawn on the tall grid, where the court is the field itself. */
function playerTop(game: ReturnType<typeof createPong>): number {
  const { ctx, rects } = canvas();
  game.draw(ctx, { grid: TALL, theme: DEFAULT_THEME } as FrameState);
  return rects.find(([c]) => c === DEFAULT_THEME.cyan)?.[2] ?? Number.NaN;
}

/** Plays `seconds` at 60 frames a second, and counts the frames that ended the match. */
function play(game: ReturnType<typeof createPong>, seconds: number): number {
  let overs = 0;
  for (let i = 0; i < seconds * 60; i++) if (game.step(1 / 60).over) overs++;
  return overs;
}

describe('the match, played by the voice', () => {
  it('START starts the match once the microphone is on, and not before', async () => {
    const off = createPong({ mic: fakeMic('blocked'), store: memory().store });
    off.press('start');
    expect(off.hud().phase).toBe('ready');
    const { game } = await micOn();
    game.press('start');
    expect(game.hud()).toMatchObject({ phase: 'play', score: 0, lives: MATCH.lives });
  });

  it('moves the paddle up above the band, down below it, and holds it still in silence, at one speed', async () => {
    const { mic, game } = await micOn();
    game.press('start');
    const at = playerTop(game);
    mic.heard = LIMITS.MID + 40;
    game.step(0.05);
    const up = playerTop(game);
    expect(up).toBeLessThan(at);
    mic.heard = null;
    game.step(0.05);
    expect(playerTop(game)).toBe(up);
    mic.heard = LIMITS.MID - 40;
    game.step(0.05);
    expect(playerTop(game)).toBe(at);
    mic.heard = LIMITS.MID + 300;
    game.step(0.05);
    expect(playerTop(game)).toBe(up);
  });

  it('draws the steering sign beside the player\'s paddle while the match plays', async () => {
    const { mic, game } = await micOn();
    game.press('start');
    mic.heard = LIMITS.MID + 40;
    game.step(1 / 60);
    const { ctx, rects } = canvas();
    game.draw(ctx, { grid: TALL, theme: DEFAULT_THEME } as FrameState);
    const [paddle, ...sign] = rects.filter(([c]) => c === DEFAULT_THEME.cyan);
    expect(sign.length).toBeGreaterThan(1);
    for (const [, x] of sign) expect(x).toBeGreaterThan((paddle?.[1] ?? 0) + (paddle?.[3] ?? 0));
    const widths = sign.map(([, , , w]) => w);
    expect(widths[0]).toBeLessThan(widths[widths.length - 1] ?? 0); // the point of ▲ on top
  });

  it('ends at the third point conceded, said once, the lives gone', async () => {
    const { game } = await micOn(LIMITS.MID + 300); // the paddle pinned to the top: most balls get past it
    game.press('start');
    expect(play(game, 300)).toBe(1);
    expect(game.hud()).toMatchObject({ phase: 'over', lives: 0 });
    expect(play(game, 5)).toBe(0);
  });

  it('START pauses and only START resumes, the microphone stopped meanwhile and asked for again', async () => {
    const { mic, game } = await micOn();
    game.press('start');
    game.press('start');
    expect(game.hud()).toMatchObject({ phase: 'paused', mic: 'off' });
    expect(mic.on).toBe(false);
    for (const a of ['a', 'b', 'up', 'left'] as const) expect(game.press(a)).toEqual({ leave: false });
    expect(game.hud().phase).toBe('paused');
    expect(mic.asked).toBe(1);
    game.press('start');
    expect(mic.asked).toBe(2);
    expect(game.hud().phase).toBe('paused');
    await settle();
    expect(game.hud()).toMatchObject({ phase: 'play', mic: 'on' });
  });

  it('a pause from outside pauses the match and stops the microphone', async () => {
    const { mic, game } = await micOn();
    game.press('start');
    game.pause();
    expect(game.hud()).toMatchObject({ phase: 'paused', mic: 'off' });
    expect(mic.on).toBe(false);
  });

  it('stays paused with MIC REQUIRED\'s reason when the microphone is refused on resume', async () => {
    const { mic, game } = await micOn();
    game.press('start');
    game.press('start');
    mic.answer = 'blocked';
    game.press('start');
    await settle();
    expect(game.hud()).toMatchObject({ phase: 'paused', mic: 'blocked' });
  });

  it('pauses with MIC LOST when the track ends during the match, and A asks again', async () => {
    const { mic, game } = await micOn();
    game.press('start');
    mic.end();
    expect(game.hud()).toMatchObject({ phase: 'lost', mic: 'off' });
    game.press('start');
    expect(game.hud().phase).toBe('lost');
    game.press('a');
    await settle();
    expect(game.hud()).toMatchObject({ phase: 'play', mic: 'on' });
  });

  it('SELECT on the pause or on MIC LOST ends the match, said once, the score kept', async () => {
    const { game } = await micOn();
    game.press('start');
    game.press('start');
    expect(game.press('select')).toEqual({ leave: false, over: true });
    expect(game.hud()).toMatchObject({ phase: 'over', score: 0 });
    expect(game.press('select')).toEqual({ leave: false });
    const lost = await micOn();
    lost.game.press('start');
    lost.mic.end();
    expect(lost.game.press('select')).toEqual({ leave: false, over: true });
  });

  it('A on the game over plays again from the ready screen with the microphone kept; B leaves and stops it', async () => {
    const { mic, game } = await micOn(LIMITS.MID + 300);
    game.press('start');
    play(game, 300);
    expect(mic.on).toBe(true);
    expect(game.press('a')).toEqual({ leave: false, again: true });
    expect(game.hud()).toMatchObject({ phase: 'ready', mic: 'on', score: 0, lives: MATCH.lives });
    expect(mic.asked).toBe(1);
    game.press('start');
    play(game, 300);
    expect(game.press('b')).toEqual({ leave: true });
    expect(mic.on).toBe(false);
  });

  it('a pause from outside on the game over still stops the microphone', async () => {
    const { mic, game } = await micOn();
    game.press('start');
    game.press('start');
    game.press('select');
    game.pause();
    expect(mic.on).toBe(false);
    game.press('a');
    expect(game.hud()).toMatchObject({ phase: 'ready', mic: 'off' });
  });

  it('plays the same match from the same seed', async () => {
    const a = (await micOn(LIMITS.MID + 300, 42)).game;
    const b = (await micOn(LIMITS.MID + 300, 42)).game;
    a.press('start');
    b.press('start');
    play(a, 20);
    play(b, 20);
    expect(a.hud()).toEqual(b.hud());
  });
});
