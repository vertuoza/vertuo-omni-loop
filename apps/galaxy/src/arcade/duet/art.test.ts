import { describe, expect, it } from 'vitest';
import { RAMPS } from '@omni/design';
import { DEFAULT_THEME } from '../theme';
import type { FrameState } from '../scenes/common.ts';
import { createDuet, drawField, hudOf } from './art';
import { CHAPTER_LINES, ENDLESS_LINES, LINE_SECONDS } from './lines';
import { RULES } from './rules';
import { CRASH_SECONDS, newRun, pause, press, step, type Run } from './run';
import { blocksAt, CHAPTERS } from './waves';

// OMNI DUET's playfield and what the text layer reads of a run (PRD 1633, slice 3; issue 1692): the
// chapter's backdrop, the wave's Entropy blocks drawn in Entropy's ramp with their trails, in the
// field's own pixels, without turning or moving the canvas, and each wave's line.

/** A 2D context that keeps every fill colour, and every call that would move, turn or clip the canvas. */
function recorder() {
  const colours = new Set<string>();
  const moves: string[] = [];
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'translate' || prop === 'rotate' || prop === 'scale' || prop === 'setTransform') return () => { moves.push(prop); };
      return () => {};
    },
    set(target, prop, value) {
      if (prop === 'fillStyle' && typeof value === 'string') colours.add(value);
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, colours, moves };
}

const frame = { theme: DEFAULT_THEME, reduced: false, t: 0 } as unknown as FrameState;

/** One rectangle filled: its colour, its alpha and where. */
interface Fill { colour: string; alpha: number; x: number; y: number; w: number; h: number }

/** Every rectangle `drawField` fills for `run` on `s`, in order. */
function fills(run: Run, s: FrameState = frame): Fill[] {
  const out: Fill[] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1, fillStyle: '' };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'fillRect') return (x: number, y: number, w: number, h: number) => { out.push({ colour: String(target.fillStyle), alpha: Number(target.globalAlpha), x, y, w, h }); };
      return () => {};
    },
  }) as unknown as CanvasRenderingContext2D;
  drawField(ctx, s, run);
  return out;
}

/** The backdrop's rectangles: those filled after the field's dark and before the circle's first dot. */
function backdropOf(run: Run, s: FrameState = frame): Fill[] {
  const all = fills(run, s);
  return all.slice(1, all.findIndex((f) => f.colour === DEFAULT_THEME.dim));
}

/** A run in play `seconds` after START, the orbs held still. */
function after(seconds: number): Run {
  let run = press(newRun({ seed: 1 }), 'start').run;
  for (let i = 0; i < Math.round(seconds / RULES.subStep); i++) run = step(run, new Set(), RULES.subStep).run;
  return run;
}

describe('the playfield', () => {
  const entropy = RAMPS.Z ?? [];

  it('draws the falling wave\'s blocks in Entropy\'s ramp, without moving or turning the canvas', () => {
    const { ctx, colours, moves } = recorder();
    drawField(ctx, frame, after(2));
    for (const c of entropy) expect(colours.has(c), c).toBe(true);
    expect(moves).toEqual([]);
  });

  it('leaves the circle\'s centre empty: nothing but the field\'s dark is drawn there', () => {
    const covering: string[] = [];
    const state: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(state, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'fillRect') {
          return (x: number, y: number, w: number, h: number) => {
            const { x: cx, y: cy } = RULES.centre;
            if (x <= cx && cx < x + w && y <= cy && cy < y + h) covering.push(String(target.fillStyle));
          };
        }
        return () => {};
      },
    }) as unknown as CanvasRenderingContext2D;
    drawField(ctx, frame, newRun({ seed: 1 }));
    expect(covering).toEqual([DEFAULT_THEME.void]);
  });

  it('draws a ghost whole as it enters and fades it out: near the circle, no ghost is drawn at all', () => {
    // Chapter IV's ninth wave is all ghosts.
    const chapter = 3, wave = 8;
    const ghosts = CHAPTERS[chapter]?.waves[wave];
    if (!ghosts?.pieces.every((p) => p.ghost)) throw new Error('not a wave of ghosts');
    const tickWhen = (k: number, cy: number) => { let t = 0; while ((blocksAt(ghosts, t)[k]?.cy ?? Infinity) < cy) t++; return t; };
    /** The Entropy fills drawn `tick` sub-steps into the wave, and the least alpha any was drawn at. */
    const drawn = (tick: number) => {
      const fills: number[] = [];
      const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
      const ctx = new Proxy(state, {
        get(target, prop) {
          if (prop in target) return target[prop];
          if (prop === 'fillRect') return () => { if (entropy.includes(String(target.fillStyle))) fills.push(Number(target.globalAlpha)); };
          return () => {};
        },
      }) as unknown as CanvasRenderingContext2D;
      drawField(ctx, frame, { ...newRun({ seed: 1 }), phase: 'play', chapter, wave, tick, started: true });
      return fills;
    };
    const entering = drawn(tickWhen(0, 0));
    expect(entering.length).toBeGreaterThan(0);
    expect(Math.max(...entering)).toBe(1);
    // Its first ghost halfway down its fade (the others, above the playfield, still whole).
    expect(Math.min(...drawn(tickWhen(0, 22)))).toBeCloseTo(0.5, 1);
    // The last ghost at the circle's top: every ghost of the wave is gone (a gate is two blocks).
    expect(drawn(tickWhen(blocksAt(ghosts, 0).length - 1, RULES.centre.y - RULES.radius))).toEqual([]);
  });

  it('draws no block on the ready screen', () => {
    const { ctx, colours } = recorder();
    drawField(ctx, frame, newRun({ seed: 1 }));
    for (const c of entropy) expect(colours.has(c), c).toBe(false);
  });

  it('shows the contact that cost a life: the blocks stay where they struck under a fading flash, then the ready screen clears', () => {
    let run = press(newRun({ seed: 1 }), 'start').run;
    for (let hit = false; !hit;) { const s = step(run, new Set(), RULES.subStep); run = s.run; hit = s.events.includes('hit'); }
    expect(run.phase).toBe('ready');
    const { ctx, colours } = recorder();
    drawField(ctx, frame, run);
    for (const c of entropy) expect(colours.has(c), c).toBe(true);
    const flash = (r: Run, s: FrameState = frame) => fills(r, s).filter((f) => f.colour === DEFAULT_THEME.white && f.w === RULES.field.w && f.h === RULES.field.h);
    expect(flash(run).length).toBe(1);
    expect(flash(run, { ...frame, reduced: true })).toEqual([]);
    for (let i = 0; i < Math.ceil(CRASH_SECONDS / RULES.maxDt) + 1; i++) run = step(run, new Set(), RULES.maxDt).run;
    const later = recorder();
    drawField(later.ctx, frame, run);
    for (const c of entropy) expect(later.colours.has(c), c).toBe(false);
    expect(flash(run)).toEqual([]);
  });

  it('keeps the wave\'s blocks where they stood under the pause', () => {
    const { ctx, colours } = recorder();
    drawField(ctx, frame, pause(after(2)).run);
    for (const c of entropy) expect(colours.has(c), c).toBe(true);
  });
});

describe('the backdrops and the trails', () => {
  const ready = (chapter: number, endless = false): Run => ({ ...newRun({ seed: 1 }), chapter, endless });
  const moving: FrameState = { ...frame, t: 3 };
  const still: FrameState = { ...frame, t: 3, reduced: true };
  /** How much light a backdrop lays on the field: each rectangle's area, alpha and brightness. */
  const light = (drop: readonly Fill[]) => drop.reduce((sum, f) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(f.colour.slice(i, i + 2), 16));
    return sum + f.w * f.h * f.alpha * ((r ?? 0) + (g ?? 0) + (b ?? 0));
  }, 0);

  it('lays each chapter its own backdrop behind the field, dim, in a theme colour, and endless mode a darker one', () => {
    const drops = [0, 1, 2, 3].map((c) => backdropOf(ready(c)));
    const endless = backdropOf(ready(3, true));
    const tokens = new Set(Object.values(DEFAULT_THEME));
    for (const drop of [...drops, endless]) {
      expect(drop.length).toBeGreaterThan(20);
      for (const f of drop) expect(tokens.has(f.colour), f.colour).toBe(true);
    }
    for (const drop of drops) for (const f of drop) expect(f.alpha).toBeLessThan(1);
    const shapes = new Set([...drops, endless].map((d) => JSON.stringify(d)));
    expect(shapes.size).toBe(5);
    for (const drop of drops) expect(light(endless)).toBeLessThan(light(drop));
  });

  it('drifts the backdrop with time, and holds it still under reduced motion', () => {
    for (const run of [ready(0), ready(1), ready(2), ready(3), ready(3, true)]) {
      expect(backdropOf(run, moving)).not.toEqual(backdropOf(run, frame));
      expect(backdropOf(run, still)).toEqual(backdropOf(run, { ...frame, reduced: true }));
    }
  });

  it('draws a soft trail fading upward about R above each falling block, in the theme\'s plasma, under the blocks; none under reduced motion', () => {
    const run = after(2);
    const drawn = fills(run);
    const trail = drawn.filter((f) => f.colour === DEFAULT_THEME.plasma);
    expect(trail.length).toBeGreaterThan(0);
    for (const f of trail) expect(f.alpha).toBeLessThan(0.2);
    const entropy = RAMPS.Z ?? [];
    const firstBlock = drawn.findIndex((f) => entropy.includes(f.colour));
    expect(drawn.findLastIndex((f) => f.colour === DEFAULT_THEME.plasma)).toBeLessThan(firstBlock);
    // The faintest at the top, R above the block's top edge at the most.
    const blocks = blocksAt(CHAPTERS[0]?.waves[0] ?? { speed: 1, ramp: { from: 0, seconds: 1, gain: 0 }, pieces: [] }, run.tick);
    const top = Math.min(...blocks.map((b) => b.cy - b.h / 2));
    expect(Math.min(...trail.map((f) => f.y))).toBeGreaterThanOrEqual(Math.floor(top - RULES.radius) - 1);
    const highest = trail.filter((f) => f.y === Math.min(...trail.map((t) => t.y)));
    expect(Math.max(...highest.map((f) => f.alpha))).toBeLessThan(Math.max(...trail.map((f) => f.alpha)));
    expect(fills(run, { ...frame, reduced: true }).some((f) => f.colour === DEFAULT_THEME.plasma)).toBe(false);
  });
});

describe('what the text layer reads of a run', () => {
  it('shows each wave\'s line in its first seconds of play, and not after, nor on a ready screen or the pause', () => {
    const playing = { ...newRun({ seed: 1 }), phase: 'play' as const, chapter: 1, wave: 3, started: true };
    expect(hudOf(playing).line).toBe(CHAPTER_LINES[1]?.[3]);
    const steps = Math.round(LINE_SECONDS / RULES.subStep);
    expect(hudOf({ ...playing, tick: steps - 1 }).line).toBe(CHAPTER_LINES[1]?.[3]);
    expect(hudOf({ ...playing, tick: steps }).line).toBeUndefined();
    expect(hudOf({ ...playing, phase: 'ready' }).line).toBeUndefined();
    expect(hudOf({ ...playing, phase: 'paused' }).line).toBeUndefined();
    expect(hudOf({ ...playing, endless: true, chapter: 3, wave: 11 }).line).toBe(ENDLESS_LINES[11 % ENDLESS_LINES.length]);
  });

  it('counts the wave from 1, out of the chapter\'s waves', () => {
    expect(hudOf(newRun({ seed: 1 }))).toEqual({
      phase: 'ready', chapter: { numeral: 'I', name: 'DRIFT' }, endless: false, wave: 1, waves: 10, lives: 3, score: 0, passed: 0, started: false,
    });
    expect(hudOf({ ...newRun({ seed: 1 }), phase: 'play', chapter: 2, wave: 3, score: 230 })).toMatchObject({ chapter: { numeral: 'III', name: 'SPIN' }, wave: 4, score: 230 });
  });

  it('never counts past the chapter\'s last wave', () => {
    expect(hudOf({ ...newRun({ seed: 1 }), phase: 'play', chapter: 3, wave: 10 }).wave).toBe(10);
  });

  it('counts endless waves from 1, with no last one', () => {
    expect(hudOf({ ...newRun({ seed: 1 }), phase: 'play', chapter: 3, endless: true, wave: 11, passed: 51, started: true }))
      .toMatchObject({ endless: true, wave: 12, waves: 0, passed: 51, started: true });
  });
});

describe('the game as the arcade drives it', () => {
  /** Holds still and presses START on each ready screen until the run is over: what the game told on the way. */
  function toOver() {
    const game = createDuet({ seed: 1 });
    const told: string[] = [];
    game.press('start');
    for (let i = 0; i < 20_000 && game.hud().phase !== 'over'; i++) {
      if (game.hud().phase === 'ready') { const p = game.press('start'); if (p.over) told.push('over'); continue; }
      if (game.step(new Set(), RULES.subStep).over) told.push('over');
    }
    return { game, told };
  }

  it('tells the move into over once, from the step that lost the last life', () => {
    const { game, told } = toOver();
    expect(game.hud()).toMatchObject({ phase: 'over', lives: 0 });
    expect(told).toEqual(['over']);
    expect(game.step(new Set(['left']), RULES.maxDt).over).toBe(false);
    for (const action of ['start', 'select', 'b', 'left'] as const) expect(game.press(action).over, action).toBe(false);
  });

  it('tells the move into over from SELECT on the pause, and A beginning again', () => {
    const game = createDuet({ seed: 1 });
    expect(game.press('start')).toEqual({ leave: false, over: false, again: false });
    game.step(new Set(), 0.05);
    game.pause();
    expect(game.hud().phase).toBe('paused');
    expect(game.press('select')).toEqual({ leave: false, over: true, again: false });
    expect(game.press('a')).toEqual({ leave: false, over: false, again: true });
    expect(game.hud()).toMatchObject({ phase: 'ready', started: false, score: 0, lives: 3 });
    expect(game.press('b')).toEqual({ leave: true, over: false, again: false });
  });
});
