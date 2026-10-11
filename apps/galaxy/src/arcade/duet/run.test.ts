import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { RULES } from './rules';
import { CHAPTERS, newRun, press, step, type Run } from './run';

// OMNI DUET's run (PRD 1633, slice 2): the ready screen, START into play, B back to the room, and the
// orbs turned in fixed steps whatever the frame rate.

const held = (...actions: Action[]): ReadonlySet<Action> => new Set(actions);
const playing = (): Run => press(newRun({ seed: 7 }), 'start').run;

/** `frames` frames of `dt` seconds each, with `buttons` held throughout. */
function stepped(run: Run, buttons: ReadonlySet<Action>, dt: number, frames: number): Run {
  let r = run;
  for (let i = 0; i < frames; i++) r = step(r, buttons, dt).run;
  return r;
}

describe('a new run', () => {
  it('waits on the ready screen of chapter I · DRIFT, with three lives and no score', () => {
    const run = newRun({ seed: 7 });
    expect(run).toMatchObject({ phase: 'ready', chapter: 0, lives: 3, score: 0, seed: 7, angle: 0, carry: 0 });
    expect(CHAPTERS[run.chapter]).toEqual({ numeral: 'I', name: 'DRIFT' });
    expect(CHAPTERS.map((c) => `${c.numeral} · ${c.name}`)).toEqual(['I · DRIFT', 'II · SLIDE', 'III · SPIN', 'IV · STORM']);
  });

  it('does not turn the orbs before START: nothing moves on the ready screen', () => {
    const run = newRun({ seed: 7 });
    const { run: after, events } = step(run, held('left'), 0.05);
    expect(after).toBe(run);
    expect(events).toEqual([]);
  });
});

describe('the presses', () => {
  it('starts play on START, and only on START', () => {
    const run = newRun({ seed: 7 });
    for (const action of ['a', 'left', 'right', 'up', 'down', 'select'] as const) {
      const pressed = press(run, action);
      expect(pressed.run, action).toBe(run);
      expect(pressed.events, action).toEqual([]);
    }
    const { run: next, events } = press(run, 'start');
    expect(next.phase).toBe('play');
    expect(events).toEqual(['start']);
  });

  it('leaves for the room on B from the first ready screen, with no score', () => {
    const { run, events } = press(newRun({ seed: 7 }), 'b');
    expect(events).toEqual(['leave']);
    expect(run.score).toBe(0);
  });
});

describe('the turn in play', () => {
  it('turns the pair anticlockwise under ◀ and clockwise under ▶, at 1.75 turns a second', () => {
    const left = stepped(playing(), held('left'), 1 / 60, 30);
    expect(left.angle).toBeCloseTo(Math.PI * 2 * 1.75 * 0.5, 9);
    const right = stepped(playing(), held('right'), 1 / 60, 30);
    expect(right.angle).toBeCloseTo(-Math.PI * 2 * 1.75 * 0.5, 9);
    expect(stepped(playing(), held('left', 'right'), 1 / 60, 30).angle).toBe(0);
    expect(stepped(playing(), held(), 1 / 60, 30).angle).toBe(0);
  });

  it('plays fixed 1/60 s steps and carries the remainder to the next call', () => {
    const half = step(playing(), held('left'), RULES.subStep / 2).run;
    expect(half.angle).toBe(0);
    expect(half.carry).toBeCloseTo(RULES.subStep / 2, 12);
    const whole = step(half, held('left'), RULES.subStep / 2).run;
    expect(whole.angle).toBeCloseTo(Math.PI * 2 * 1.75 * RULES.subStep, 12);
    expect(whole.carry).toBeCloseTo(0, 12);
  });

  it('caps a long frame at 50 ms: a stalled tab never plays a second at once', () => {
    const slow = step(playing(), held('left'), 1).run;
    const capped = step(playing(), held('left'), RULES.maxDt).run;
    expect(slow.angle).toBe(capped.angle);
    expect(slow.angle).toBeCloseTo(Math.PI * 2 * 1.75 * 3 * RULES.subStep, 12);
  });

  it('gives the same angle stepped at 1/60 s and at 1/120 s, for the same inputs', () => {
    const script: [Action[], number][] = [[['left'], 0.5], [[], 0.25], [['right'], 0.75], [['left', 'right'], 0.25], [['left'], 1]];
    const play = (dt: number) => script.reduce((r, [buttons, seconds]) => stepped(r, held(...buttons), dt, Math.round(seconds / dt)), playing());
    const at60 = play(1 / 60), at120 = play(1 / 120);
    expect(at120.angle).toBe(at60.angle);
    expect(at60.angle).not.toBe(0);
  });

  it('keeps a short trail of where the warm orb was, newest first', () => {
    const run = stepped(playing(), held('left'), 1 / 60, 20);
    expect(run.trail).toHaveLength(RULES.trail);
    expect(run.trail[0]).toBeLessThan(run.angle);
    for (let i = 1; i < run.trail.length; i++) expect(run.trail[i]).toBeLessThan(run.trail[i - 1] ?? Infinity);
  });
});
