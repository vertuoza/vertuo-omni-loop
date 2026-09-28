import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_OUTBOX_PART, OUTBOX_MS, outboxRead, pollOutbox, readOutbox } from './outbox';
import type { WaitingOutbox } from './waiting';

// The waiting list's Outbox part (PRD 499, s3): read from GET /api/waiting/outbox once after load and
// every 60 s while the tab is visible, never twice within 60 s; a failed read keeps the last items.

const item = (id: string, prd = 459): WaitingOutbox => ({ kind: 'outbox', id, prd, dossierId: `d${prd}`, title: 'Gate', rank: 'high', question: 'Why?' });
const wire = (i: WaitingOutbox) => ({ id: i.id, prd: i.prd, dossierId: i.dossierId, title: i.title, rank: i.rank, question: i.question });

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

describe('reading the outbox route', () => {
  const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it('asks GET /api/waiting/outbox and gives its items as the list\'s outbox items, and how many PRDs it could not read', async () => {
    const fetch = answer(200, { items: [wire(item('d1:a'))], unread: 2 });
    expect(await readOutbox(fetch)).toEqual({ ok: true, items: [item('d1:a')], unreadPrds: 2 });
    expect(fetch).toHaveBeenCalledWith('/api/waiting/outbox', { cache: 'no-store' });
  });

  it('fails on a status that is not 200, naming it', async () => {
    expect(await readOutbox(answer(401, { error: 'Sign in' }))).toEqual({ ok: false, kind: 'status 401' });
    expect(await readOutbox(answer(500, { error: 'x' }))).toEqual({ ok: false, kind: 'status 500' });
  });

  it('fails on an answer it cannot read, and when the network fails', async () => {
    expect(await readOutbox(answer(200, { items: 'no' }))).toEqual({ ok: false, kind: 'shape' });
    expect(await readOutbox(answer(200, { items: [{ id: 'x' }], unread: 0 }))).toEqual({ ok: false, kind: 'shape' });
    expect(await readOutbox(vi.fn(async () => { throw new Error('offline'); }))).toEqual({ ok: false, kind: 'network' });
  });
});

describe('the Outbox part after a read', () => {
  it('starts empty and readable', () => {
    expect(EMPTY_OUTBOX_PART).toEqual({ items: [], unread: false, unreadPrds: 0 });
  });

  it('takes a read\'s items', () => {
    const next = outboxRead(EMPTY_OUTBOX_PART, { ok: true, items: [item('a')], unreadPrds: 1 });
    expect(next).toEqual({ items: [item('a')], unread: false, unreadPrds: 1 });
  });

  it('keeps the last items when a read fails, and marks itself unreadable', () => {
    const before = { items: [item('a')], unread: false, unreadPrds: 1 };
    expect(outboxRead(before, { ok: false, kind: 'network' })).toEqual({ items: [item('a')], unread: true, unreadPrds: 1 });
  });

  it('is readable again after a read that works', () => {
    const failed = { items: [item('a')], unread: true, unreadPrds: 0 };
    expect(outboxRead(failed, { ok: true, items: [], unreadPrds: 0 })).toEqual(EMPTY_OUTBOX_PART);
  });
});

describe('polling the outbox', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads every 60 s', () => {
    expect(OUTBOX_MS).toBe(60_000);
  });

  it('reads once after load, then every 60 s while the tab is visible', async () => {
    const p = page();
    const read = vi.fn(async () => {});
    const stop = pollOutbox(read, p.doc, () => Date.now());
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(read).toHaveBeenCalledTimes(4);
    stop();
  });

  it('never reads twice within 60 s, even when the tab shows again', async () => {
    const p = page();
    const read = vi.fn(async () => {});
    const stop = pollOutbox(read, p.doc, () => Date.now());
    await vi.advanceTimersByTimeAsync(10_000);
    p.show(false);
    p.show(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    stop();
  });

  it('reads at once when the tab shows again after 60 s', async () => {
    const p = page();
    const read = vi.fn(async () => {});
    const stop = pollOutbox(read, p.doc, () => Date.now());
    await vi.advanceTimersByTimeAsync(0);
    p.show(false);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(read).toHaveBeenCalledTimes(1);
    p.show(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
  });

  it('does not read while the tab is hidden at load, and reads once it shows', async () => {
    const p = page(false);
    const read = vi.fn(async () => {});
    const stop = pollOutbox(read, p.doc, () => Date.now());
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(0);
    p.show(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stops reading once stopped', async () => {
    const p = page();
    const read = vi.fn(async () => {});
    const stop = pollOutbox(read, p.doc, () => Date.now());
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
