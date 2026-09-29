import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pollQuestions } from './questions-poll';
import { HIDDEN_WAITING_MS, WAITING_MS } from './waiting';

// Calmer polling (PRD 657, s10): the waiting provider reads the Questions part every 5 s while the
// tab is visible and every 15 s while it is hidden, and at once when the tab shows again.

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

describe('the questions poll', () => {
  it('runs every 5 s while visible and every 15 s while hidden', async () => {
    expect(WAITING_MS).toBe(5000);
    expect(HIDDEN_WAITING_MS).toBe(15_000);
    const p = page();
    const tick = vi.fn(async () => true);
    const stop = pollQuestions(tick, p.doc);
    await vi.advanceTimersByTimeAsync(4999);
    expect(tick).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(2);
    p.show(false);
    // The read already set 5 s from now runs; after it, hidden reads come every 15 s.
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(tick).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(tick).toHaveBeenCalledTimes(6);
    stop();
  });

  it('starts at 15 s in a tab that loads hidden', async () => {
    const p = page(false);
    const tick = vi.fn(async () => true);
    const stop = pollQuestions(tick, p.doc);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(tick).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(1);
    stop();
  });

  it('polls at once when the tab becomes visible again, then every 5 s', async () => {
    const p = page(false);
    const tick = vi.fn(async () => true);
    const stop = pollQuestions(tick, p.doc);
    await vi.advanceTimersByTimeAsync(3000);
    p.show(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(2);
    stop();
  });

  it('never overlaps a read, and a read that throws keeps the polling going', async () => {
    const p = page();
    let release = () => {};
    const tick = vi.fn<() => Promise<boolean>>()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => { release = () => resolve(true); }))
      .mockImplementationOnce(async () => { throw new Error('offline'); })
      .mockImplementation(async () => true);
    const stop = pollQuestions(tick, p.doc);
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(1);
    p.show(false);
    p.show(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(tick).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it('stops on a read that resolves false, and on stop()', async () => {
    const p = page();
    const ended = vi.fn(async () => false);
    pollQuestions(ended, p.doc);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(p.listeners.size).toBe(0);

    const q = page();
    const tick = vi.fn(async () => true);
    const stop = pollQuestions(tick, q.doc);
    stop();
    q.show(false);
    q.show(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(0);
    expect(q.listeners.size).toBe(0);
  });

  it('is the poll the waiting provider reads its questions with', () => {
    const source = readFileSync(join(__dirname, 'WaitingProvider.tsx'), 'utf8');
    expect(source).toMatch(/pollQuestions\(/);
    expect(source).not.toMatch(/document, WAITING_MS\)/);
  });
});
