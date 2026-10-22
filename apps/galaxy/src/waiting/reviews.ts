import { z } from 'zod';
import { PrdNumberSchema, PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { WaitingReview } from './waiting';

// The waiting list's Reviews part (PRD 2377 s5): the open review, merge and law waits whose turn names the
// person by login (never by a team), read by the browser from GET /api/waiting/reviews once after load and
// every 15 s while the tab is visible, through the Outbox part's poll (src/waiting/outbox.ts). It is a
// wait: it adds to the bell's badge, the tab's `(N)` and the favicon dot, and it is the Waiting entry's
// badge. Approvals and outbox items are never in it: their own parts hold them. It raises no alert. A
// failed read keeps the waits it last had and marks the part unreadable.

/** How often the Reviews part is read while the tab is visible, and the least time between two reads. */
export const REVIEWS_MS = 15_000;

const REVIEWS_ROUTE = '/api/waiting/reviews';

/** The Reviews part: its waits, oldest first, and whether its last read failed. */
export type ReviewsPart = { items: WaitingReview[]; unread: boolean };

export const EMPTY_REVIEWS_PART: ReviewsPart = { items: [], unread: false };

/** One read of the route: its waits, or the kind of failure (logged once per kind). */
export type ReviewsRead = { ok: true; items: WaitingReview[] } | { ok: false; kind: string };

type Fetch = (url: string, init: { cache: 'no-store' }) => Promise<Response>;

/** What the route answers. */
const Answer = z.object({
  items: z.array(z.object({
    kind: z.enum(['review', 'merge', 'law']),
    id: z.string().min(1),
    prd: PrdNumberSchema.nullable(),
    pr: PrNumberSchema,
    repo: z.string().min(1),
    since: z.number(),
  })),
});

/** The route's answer as JSON, or the kind of failure. */
async function answerOf(fetch: Fetch): Promise<{ ok: true; body: unknown } | { ok: false; kind: string }> {
  try {
    const response = await fetch(REVIEWS_ROUTE, { cache: 'no-store' });
    if (response.status !== 200) return { ok: false, kind: `status ${response.status}` };
    return { ok: true, body: await response.json() };
  } catch (error) {
    return { ok: false, kind: error instanceof SyntaxError ? 'shape' : 'network' };
  }
}

/** Reads the route once. Never throws. */
export async function readReviews(fetch: Fetch): Promise<ReviewsRead> {
  const answer = await answerOf(fetch);
  if (!answer.ok) return answer;
  const parsed = Answer.safeParse(answer.body);
  return parsed.success ? { ok: true, items: parsed.data.items } : { ok: false, kind: 'shape' };
}

/** The part after a read: a read that works replaces it; one that fails keeps its waits, unreadable. */
export function reviewsRead(part: ReviewsPart, read: ReviewsRead): ReviewsPart {
  return read.ok ? { items: read.items, unread: false } : { ...part, unread: true };
}
