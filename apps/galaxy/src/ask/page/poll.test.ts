import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { POLL_MS, poll } from './poll';

/** A document whose visibility a test flips. */
function page(visible = true) {
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: visible ? 'visible' : 'hidden',
    addEventListener: (_: 'visibilitychange', fn: () => void) => listeners.add(fn),
    removeEventListener: (_: 'visibilitychange', fn: () => void) => listeners.delete(fn),
  };
  return {
    doc,
    listeners,
    show(on: boolean) {
      doc.visibilityState = on ? 'visible' : 'hidden';
      for (const fn of listeners) fn();
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('polling', () => {
  it('reads every 2 s while the tab is visible', async () => {
    expect(POLL_MS).toBe(2000);
    const p = page();
    const tick = vi.fn(async () => true);
    const stop = poll(tick, p.doc);
    await vi.advanceTimersByTimeAsync(1999);
    expect(tick).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it('rests while the tab is hidden, and reads at once when it shows again', async () => {
    const p = page();
    const tick = vi.fn(async () => true);
    const stop = poll(tick, p.doc);
    await vi.advanceTimersByTimeAsync(2000);
    p.show(false);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(tick).toHaveBeenCalledTimes(1);
    p.show(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it('never starts a read while one is still out', async () => {
    const p = page();
    let finish: (more: boolean) => void = () => {};
    const tick = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const stop = poll(tick, p.doc);
    await vi.advanceTimersByTimeAsync(2000);
    p.show(false);
    p.show(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(1);
    finish(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(tick).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stops when a read says there is nothing more to wait for, or when stopped', async () => {
    const p = page();
    const done = vi.fn(async () => false);
    poll(done, p.doc);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(done).toHaveBeenCalledTimes(1);

    const tick = vi.fn(async () => true);
    const stop = poll(tick, p.doc);
    await vi.advanceTimersByTimeAsync(2000);
    stop();
    p.show(false);
    p.show(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(p.listeners.size).toBe(0);
  });

  it('keeps going after a read that failed', async () => {
    const p = page();
    const tick = vi.fn(async () => { throw new Error('offline'); });
    const stop = poll(tick, p.doc);
    await vi.advanceTimersByTimeAsync(6000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it('waits for the tab to show before the first read', async () => {
    const p = page(false);
    const tick = vi.fn(async () => true);
    const stop = poll(tick, p.doc);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(0);
    p.show(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    stop();
  });
});
