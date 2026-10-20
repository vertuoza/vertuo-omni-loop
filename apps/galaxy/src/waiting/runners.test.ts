import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APPROVALS_MS } from './approvals';
import { EMPTY_RUNNERS_PART, pollRunners, RUNNERS_MS, runnersFailed, runnersSeen } from './runners';

// The waiting list's Runners part (PRD 2255, s4): how many of the workspace's runner jobs wait for an
// answer, read from GET /api/waiting/runners every 15 s while the tab is visible, as the Approvals part is;
// a failed read keeps the last count.

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
    show(on: boolean) {
      doc.visibilityState = on ? 'visible' : 'hidden';
      for (const fn of listeners) fn();
    },
  };
}

describe('the Runners part', () => {
  it('starts at none, read', () => {
    expect(EMPTY_RUNNERS_PART).toEqual({ count: 0, unread: false });
  });

  it('is replaced by a read that works, which clears the unreadable mark', () => {
    expect(runnersFailed(runnersSeen(2))).toEqual({ count: 2, unread: true });
    expect(runnersSeen(1)).toEqual({ count: 1, unread: false });
    expect(runnersSeen(0)).toEqual({ count: 0, unread: false });
  });

  it('keeps its last count, marked unreadable, when a read fails', () => {
    expect(runnersFailed({ count: 3, unread: false })).toEqual({ count: 3, unread: true });
    expect(runnersFailed(EMPTY_RUNNERS_PART)).toEqual({ count: 0, unread: true });
  });
});

describe('the Runners part\'s poll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads every 15 s, as the Approvals part is', () => {
    expect(RUNNERS_MS).toBe(15_000);
    expect(RUNNERS_MS).toBe(APPROVALS_MS);
  });

  it('reads once after load, then every 15 s while the tab is visible', async () => {
    const p = page();
    const tick = vi.fn(() => Promise.resolve(true));
    const stop = pollRunners(tick, p.doc);
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(tick).toHaveBeenCalledTimes(4);
    stop();
  });

  it('rests while the tab is hidden at load, and reads once it shows', async () => {
    const p = page(false);
    const tick = vi.fn(() => Promise.resolve(true));
    const stop = pollRunners(tick, p.doc);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).not.toHaveBeenCalled();
    p.show(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    stop();
  });

  it('ends once a read says to stop (the person is signed out), and when stopped', async () => {
    const p = page();
    const tick = vi.fn(() => Promise.resolve(false));
    pollRunners(tick, p.doc);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(1);

    const q = page();
    const again = vi.fn(() => Promise.resolve(true));
    const stop = pollRunners(again, q.doc);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(again).toHaveBeenCalledTimes(1);
  });
});
