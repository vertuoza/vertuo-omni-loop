import { describe, expect, it } from 'vitest';
import { drain, inSlices, nextTask, type Steps } from './slices';

// Work done a slice at a time (bug 2152): a generator that stops after each step, run at once or a slice of time at a time.

/** Work of `n` steps, each moving the clock on by `cost` ms, returning how many steps it took. */
function* counting(n: number, clock: { t: number }, cost: number): Steps<number> {
  for (let i = 0; i < n; i++) {
    clock.t += cost;
    yield;
  }
  return n;
}

describe('work done a slice at a time', () => {
  it('runs work to its end at once and returns what it returns', () => {
    const clock = { t: 0 };
    expect(drain(counting(5, clock, 1))).toBe(5);
    expect(clock.t).toBe(5);
  });

  it('pauses each time a slice of time has passed since the last pause, and never in the middle of a step', async () => {
    const clock = { t: 0 };
    const pausedAt: number[] = [];
    const done = await inSlices(counting(10, clock, 3), () => { pausedAt.push(clock.t); return Promise.resolve(); }, 8, () => clock.t);
    expect(done).toBe(10);
    expect(pausedAt).toEqual([9, 18, 27]);
  });

  it('never pauses work that fits in one slice', async () => {
    const clock = { t: 0 };
    let pauses = 0;
    expect(await inSlices(counting(2, clock, 3), () => { pauses += 1; return Promise.resolve(); }, 8, () => clock.t)).toBe(2);
    expect(pauses).toBe(0);
  });

  it('waits for the next task between two slices, not for the promises already settled', async () => {
    let done = false;
    const waited = nextTask().then(() => { done = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(false);
    await waited;
    expect(done).toBe(true);
  });
});
