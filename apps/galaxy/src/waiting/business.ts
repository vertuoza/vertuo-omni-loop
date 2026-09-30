// The waiting list's Business part (PRD 774, s5): the Monday digest. How many things wait to be
// checked on Settings › Business (a proposed evidence claim, a contradiction, a faded claim), read by
// the browser from GET /api/waiting/business once after load and every 60 s while the tab is visible,
// through the Outbox part's poll (src/waiting/outbox.ts). The bell shows it as one group, "Business ·
// N to check", linking to the page; at 0 the group is gone. Like New documents it never adds to the
// bell's badge, the tab's `(N)` or the favicon dot, and it raises no alert: no email, no sound.
// A failed read keeps the last count and marks the part unreadable.

/** How often the Business part is read while the tab is visible, and the least time between two reads. */
export const BUSINESS_MS = 60_000;

export const BUSINESS_ROUTE = '/api/waiting/business';

/** Where the group links: the page where those rows sit on top. */
export const BUSINESS_HREF = '/app/settings/business';

/** The Business part: how many things wait to be checked, and whether its last read failed. */
export type BusinessPart = { count: number; unread: boolean };

export const EMPTY_BUSINESS_PART: BusinessPart = { count: 0, unread: false };

/** One read of the route: its count, or the kind of failure (logged once per kind). */
export type BusinessRead = { ok: true; count: number } | { ok: false; kind: string };

type Fetch = (url: string, init: { cache: 'no-store' }) => Promise<Response>;

/** Reads the route once. Never throws. */
export async function readBusinessCount(fetch: Fetch): Promise<BusinessRead> {
  let response: Response;
  try {
    response = await fetch(BUSINESS_ROUTE, { cache: 'no-store' });
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
  const count = (body as { count?: unknown } | null)?.count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return { ok: false, kind: 'shape' };
  return { ok: true, count };
}

/** The part after a read: a read that works replaces it; one that fails keeps its count, unreadable. */
export function businessRead(part: BusinessPart, read: BusinessRead): BusinessPart {
  return read.ok ? { count: read.count, unread: false } : { ...part, unread: true };
}
