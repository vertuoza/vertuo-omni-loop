import type { SupervisorWaiting } from './waiting.contract';

// The waiting list's Supervisor part (omni-loop-34 s8): whether the workspace the person joined first has a Supervisor
// seat, and how many of its findings are open and high, read by the browser from GET /api/waiting/supervisor once after
// load and every 15 s while the tab is visible, on the Runners part's poll (src/waiting/runners.ts), and at once when
// the tab shows again. The sidebar shows the Supervisor row only while there is a seat, with the count as its red badge,
// none at 0 (src/nav/sidebar.ts). It never adds to the bell's badge, the tab's `(N)` or the favicon dot, and raises no
// alert here: a high finding sends its own push and email. A failed read keeps what it last had, marked unreadable.

/** The Supervisor part: the seat, the open high findings, and whether its last read failed. */
export type SupervisorPart = SupervisorWaiting & { unread: boolean };

/** Before its first read: no seat, so no row. */
export const EMPTY_SUPERVISOR_PART: SupervisorPart = { seat: false, high: 0, unread: false };

/** The part after a read that fails: it keeps what it had, unreadable. */
export const supervisorFailed = (part: SupervisorPart): SupervisorPart => ({ ...part, unread: true });
