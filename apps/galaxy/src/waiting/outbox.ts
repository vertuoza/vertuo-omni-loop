import { poll, type VisibilityDoc } from '../ask/page/poll';
import type { WaitingOutbox } from './waiting';

// The waiting list's Outbox part (PRD 499, s3): the open human-action and high outbox items of the PRDs
// the person opened, read by the browser from GET /api/waiting/outbox (src/outbox-waiting/), never by
// the page's render. Read once after load, then every 60 s while the tab is visible and at once when it
// shows again, but never twice within 60 s: the route's GitHub summaries are cached that long anyway. A
// failed read keeps the items the part last had and marks it unreadable; the next read that works
// clears the mark.

/** How often the Outbox part is read while the tab is visible, and the least time between two reads. */
export const OUTBOX_MS = 60_000;

export const OUTBOX_ROUTE = '/api/waiting/outbox';

/** The Outbox part: its items, whether its last read failed, and how many PRDs the route could not read. */
export type OutboxPart = { items: WaitingOutbox[]; unread: boolean; unreadPrds: number };

export const EMPTY_OUTBOX_PART: OutboxPart = { items: [], unread: false, unreadPrds: 0 };

/** One read of the route: its items and unread PRDs, or the kind of failure (logged once per kind). */
export type OutboxRead = { ok: true; items: WaitingOutbox[]; unreadPrds: number } | { ok: false; kind: string };

type Fetch = (url: string, init: { cache: 'no-store' }) => Promise<Response>;

const RANKS = new Set(['human-action', 'high']);

function itemOf(raw: unknown): WaitingOutbox | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.prd !== 'number' || typeof r.dossierId !== 'string' || typeof r.title !== 'string'
    || typeof r.question !== 'string' || typeof r.rank !== 'string' || !RANKS.has(r.rank)) return null;
  return { kind: 'outbox', id: r.id, prd: r.prd, dossierId: r.dossierId, title: r.title, rank: r.rank as WaitingOutbox['rank'], question: r.question };
}

/** Reads the route once. Never throws. */
export async function readOutbox(fetch: Fetch): Promise<OutboxRead> {
  let response: Response;
  try {
    response = await fetch(OUTBOX_ROUTE, { cache: 'no-store' });
  } catch {
    return { ok: false, kind: 'network' };
  }
  if (response.status !== 200) return { ok: false, kind: `status ${response.status}` };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, kind: 'shape' };
  }
  const { items, unread } = (body ?? {}) as { items?: unknown; unread?: unknown };
  if (!Array.isArray(items) || typeof unread !== 'number') return { ok: false, kind: 'shape' };
  const read = items.map(itemOf);
  if (read.some((i) => i === null)) return { ok: false, kind: 'shape' };
  return { ok: true, items: read as WaitingOutbox[], unreadPrds: unread };
}

/** The part after a read: a read that works replaces it; one that fails keeps its items, unreadable. */
export function outboxRead(part: OutboxPart, read: OutboxRead): OutboxPart {
  return read.ok ? { items: read.items, unread: false, unreadPrds: read.unreadPrds } : { ...part, unread: true };
}

/** Reads once now (when the tab is visible), then through `poll()` every `every` ms, skipping any read
 * that would come within `every` of the last one. Returns the stop function. */
export function pollOutbox(read: () => Promise<void>, doc: VisibilityDoc, clock: () => number, every = OUTBOX_MS): () => void {
  let last = -Infinity;
  const tick = async () => {
    const now = clock();
    if (now - last < every) return true;
    last = now;
    await read();
    return true;
  };
  const stop = poll(tick, doc, every);
  if (doc.visibilityState === 'visible') void tick();
  return stop;
}
