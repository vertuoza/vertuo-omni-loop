import { z } from 'zod';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { WaitingApproval } from './waiting';

// The waiting list's Approvals part (PRD 1322 s2): the approval requests that wait on the person looking,
// one per ◆ PRD whose latest request asks them and nobody approved since, read by the browser from GET
// /api/waiting/approvals once after load and every 15 s while the tab is visible, through the Outbox
// part's poll (src/waiting/outbox.ts). It is a wait: it adds to the bell's badge, the tab's `(N)` and the
// favicon dot, and a new request raises the desktop alert and the chime behind their switches. A failed
// read keeps the requests it last had and marks the part unreadable.

/** How often the Approvals part is read while the tab is visible, and the least time between two reads. */
export const APPROVALS_MS = 15_000;

const APPROVALS_ROUTE = '/api/waiting/approvals';

/** The Approvals part: its requests, oldest first, and whether its last read failed. */
export type ApprovalsPart = { items: WaitingApproval[]; unread: boolean };

export const EMPTY_APPROVALS_PART: ApprovalsPart = { items: [], unread: false };

/** One read of the route: its requests, or the kind of failure (logged once per kind). */
type ApprovalsRead = { ok: true; items: WaitingApproval[] } | { ok: false; kind: string };

type Fetch = (url: string, init: { cache: 'no-store' }) => Promise<Response>;

/** What the route answers. */
const Answer = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    dossierId: z.string().min(1),
    prd: PrdNumberSchema,
    title: z.string(),
    repo: z.string().min(1),
    askedAt: z.number(),
  })),
});

/** Reads the route once. Never throws. */
export async function readApprovals(fetch: Fetch): Promise<ApprovalsRead> {
  let response: Response;
  try {
    response = await fetch(APPROVALS_ROUTE, { cache: 'no-store' });
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
  const parsed = Answer.safeParse(body);
  if (!parsed.success) return { ok: false, kind: 'shape' };
  return { ok: true, items: parsed.data.items.map((item) => ({ kind: 'approval' as const, ...item })) };
}

/** The part after a read: a read that works replaces it; one that fails keeps its requests, unreadable. */
export function approvalsRead(part: ApprovalsPart, read: ApprovalsRead): ApprovalsPart {
  return read.ok ? { items: read.items, unread: false } : { ...part, unread: true };
}
