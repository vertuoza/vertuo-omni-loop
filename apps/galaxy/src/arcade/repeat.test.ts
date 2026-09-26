import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action } from './keys';
import { holdToRepeat, REPEAT_DELAY, REPEAT_EVERY } from './repeat';

describe('hold to repeat', () => {
  let fired: Action[];
  let pad: ReturnType<typeof holdToRepeat>;
  beforeEach(() => {
    vi.useFakeTimers();
    fired = [];
    pad = holdToRepeat((a) => fired.push(a));
  });
  afterEach(() => { pad.release(); vi.useRealTimers(); });

  it('fires a held direction once, again at 400 ms, then every 120 ms', () => {
    expect([REPEAT_DELAY, REPEAT_EVERY]).toEqual([400, 120]);
    pad.press('down');
    expect(fired).toEqual(['down']);
    vi.advanceTimersByTime(399);
    expect(fired).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(fired).toHaveLength(2);
    vi.advanceTimersByTime(119);
    expect(fired).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(fired).toHaveLength(3);
    vi.advanceTimersByTime(360);
    expect(fired).toEqual(Array(6).fill('down'));
  });

  it('stops on release', () => {
    pad.press('up');
    vi.advanceTimersByTime(450);
    pad.release();
    vi.advanceTimersByTime(2000);
    expect(fired).toEqual(['up', 'up']);
  });

  it('restarts when the direction changes', () => {
    pad.press('left');
    vi.advanceTimersByTime(300);
    pad.press('up');
    expect(fired).toEqual(['left', 'up']);
    vi.advanceTimersByTime(399);
    expect(fired).toEqual(['left', 'up']);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual(['left', 'up', 'up']);
  });

  it('never repeats A, B, START or SELECT', () => {
    for (const a of ['a', 'b', 'start', 'select'] as const) {
      fired = [];
      pad.press(a);
      vi.advanceTimersByTime(3000);
      pad.release();
      expect(fired, a).toEqual([a]);
    }
  });
});
