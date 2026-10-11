import { describe, expect, it } from 'vitest';
import { RAMPS } from '@omni/design';
import { DEFAULT_THEME } from '../theme';
import type { FrameState } from '../scenes/common.ts';
import { drawField, hudOf } from './art';
import { RULES } from './rules';
import { newRun, press, step, type Run } from './run';

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
      if (prop === 'translate' || prop === 'rotate' || prop === 'scale' || prop === 'setTransform') return () => { moves.push(String(prop)); };
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

  it('draws no block on the ready screen', () => {
    const { ctx, colours } = recorder();
    drawField(ctx, frame, newRun({ seed: 1 }));
    for (const c of entropy) expect(colours.has(c), c).toBe(false);
  });
});

describe('what the text layer reads of a run', () => {
  it('counts the wave from 1, out of the chapter\'s waves', () => {
    expect(hudOf(newRun({ seed: 1 }))).toEqual({ phase: 'ready', chapter: { numeral: 'I', name: 'DRIFT' }, wave: 1, waves: 10, lives: 3, score: 0 });
    expect(hudOf({ ...newRun({ seed: 1 }), phase: 'play', chapter: 2, wave: 3, score: 230 })).toMatchObject({ chapter: { numeral: 'III', name: 'SPIN' }, wave: 4, score: 230 });
  });

  it('never counts past the chapter\'s last wave', () => {
    expect(hudOf({ ...newRun({ seed: 1 }), phase: 'play', chapter: 3, wave: 10 }).wave).toBe(10);
  });
});
