import { describe, expect, it } from 'vitest';
import { sideBySide } from './side-by-side.ts';

/** Waits `ms` milliseconds. */
const after = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe('sideBySide', () => {
  it('keeps the results in item order, whatever order they finish in', async () => {
    expect(await sideBySide([30, 1, 15, 5], 4, async (ms) => {
      await after(ms);
      return ms * 2;
    })).toEqual([60, 2, 30, 10]);
  });

  it('runs at most `limit` at once, and runs that many when there are enough', async () => {
    const seen = { now: 0, most: 0 };
    await sideBySide(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      seen.now += 1;
      seen.most = Math.max(seen.most, seen.now);
      await after(5);
      seen.now -= 1;
    });
    expect(seen.most).toBe(3);
  });

  it('a limit of one runs them one after another, in order', async () => {
    const started: number[] = [];
    await sideBySide([1, 2, 3], 1, async (item) => {
      started.push(item);
      await after(4 - item);
    });
    expect(started).toEqual([1, 2, 3]);
  });

  it('no item gives no result and runs nothing', async () => {
    let ran = false;
    expect(await sideBySide([], 4, () => {
      ran = true;
      return Promise.resolve(0);
    })).toEqual([]);
    expect(ran).toBe(false);
  });

  it('throws the error of the first item that failed in item order, even when a later one failed first', async () => {
    const failing = sideBySide(['slow', 'quick', 'ok'], 3, async (item) => {
      await after(item === 'slow' ? 20 : 1);
      if (item !== 'ok') throw new Error(item);
      return item;
    });
    await expect(failing).rejects.toThrow('slow');
  });

  it('once an item failed, no later item starts', async () => {
    const started: string[] = [];
    const failing = sideBySide(['a', 'b', 'c', 'd'], 2, async (item) => {
      started.push(item);
      await after(item === 'b' ? 30 : 1);
      if (item === 'a') throw new Error('a');
      return item;
    });
    await expect(failing).rejects.toThrow('a');
    expect(started).toEqual(['a', 'b']);
  });
});
