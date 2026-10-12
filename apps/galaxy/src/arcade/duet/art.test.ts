import { describe, expect, it } from 'vitest';
import { RAMPS } from '@omni/design';
import { DEFAULT_THEME } from '../theme';
import type { FrameState } from '../scenes/common.ts';
import { createDuet, drawField, hudOf } from './art';
import { RULES } from './rules';
import { newRun, pause, press, step, type Run } from './run';

// OMNI DUET's playfield and what the text layer reads of a run (PRD 1633, slice 3): the wave's Entropy
// blocks drawn in Entropy's ramp, in the field's own pixels, without turning or moving the canvas.

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

const frame = { theme: DEFAULT_THEME, reduced: false } as unknown as FrameState;

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

  it('draws no block on the ready screen', () => {
    const { ctx, colours } = recorder();
    drawField(ctx, frame, newRun({ seed: 1 }));
    for (const c of entropy) expect(colours.has(c), c).toBe(false);
  });

  it('keeps the wave\'s blocks where they stood under the pause', () => {
    const { ctx, colours } = recorder();
    drawField(ctx, frame, pause(after(2)).run);
    for (const c of entropy) expect(colours.has(c), c).toBe(true);
  });
});

describe('what the text layer reads of a run', () => {
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
