import { describe, expect, it } from 'vitest';
import { APPS, openSelector, step } from './state';

// SELECT YOUR APP (PRD 932, s3): the overlay's state as a pure reducer. The keys move the cursor and
// pick; the component only draws the state and carries out what a step returns.

describe('the selector\'s state', () => {
  it('opens with the cursor on the Omni app and REMEMBER MY CHOICE off', () => {
    expect(openSelector()).toEqual({ cursor: 'app', remember: false });
    expect(APPS).toEqual(['app', 'arcade']);
  });

  it('moves the cursor with → and ←, wrapping around at either end', () => {
    const open = openSelector();
    const right = step(open, { type: 'key', key: 'ArrowRight' });
    expect(right).toEqual({ state: { cursor: 'arcade', remember: false }, effect: null });
    expect(step(right.state, { type: 'key', key: 'ArrowRight' }).state.cursor).toBe('app');
    expect(step(open, { type: 'key', key: 'ArrowLeft' }).state.cursor).toBe('arcade');
    expect(step(right.state, { type: 'key', key: 'ArrowLeft' }).state.cursor).toBe('app');
  });

  it('puts the cursor on a pedestal that takes the focus', () => {
    expect(step(openSelector(), { type: 'select', pick: 'arcade' }).state.cursor).toBe('arcade');
  });

  it('picks the selected app on Enter, and closes on Esc', () => {
    expect(step(openSelector(), { type: 'key', key: 'Enter' }).effect).toEqual({ type: 'go', pick: 'app', save: false });
    const arcade = step(openSelector(), { type: 'key', key: 'ArrowRight' }).state;
    expect(step(arcade, { type: 'key', key: 'Enter' }).effect).toEqual({ type: 'go', pick: 'arcade', save: false });
    expect(step(openSelector(), { type: 'key', key: 'Escape' }).effect).toEqual({ type: 'close' });
  });

  it('picks a clicked pedestal, wherever the cursor is', () => {
    expect(step(openSelector(), { type: 'pick', pick: 'arcade' })).toEqual({
      state: { cursor: 'arcade', remember: false },
      effect: { type: 'go', pick: 'arcade', save: false },
    });
  });

  it('saves and goes when the toggle is on, and only goes when it is off', () => {
    const on = step(openSelector(), { type: 'toggle' }).state;
    expect(on.remember).toBe(true);
    expect(step(on, { type: 'key', key: 'Enter' }).effect).toEqual({ type: 'go', pick: 'app', save: true });
    expect(step(on, { type: 'pick', pick: 'arcade' }).effect).toEqual({ type: 'go', pick: 'arcade', save: true });
    const off = step(on, { type: 'toggle' }).state;
    expect(step(off, { type: 'key', key: 'Enter' }).effect).toEqual({ type: 'go', pick: 'app', save: false });
  });

  it('ignores any other key', () => {
    const open = openSelector();
    expect(step(open, { type: 'key', key: 'a' })).toEqual({ state: open, effect: null });
  });
});
