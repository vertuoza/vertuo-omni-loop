import { poll, type VisibilityDoc } from '../ask/page/poll';

// The waiting list's Runners part (PRD 2255, s4): how many of the workspace's runner jobs wait for an
// answer (a job that ended with questions nobody has answered or dismissed: the Runners page reads it
// as Need human), read by the browser from GET /api/waiting/runners once after load and every 15 s
// while the tab is visible, as the Approvals part is (src/waiting/approvals.ts), and at once when the
// tab shows again. The sidebar shows it as the badge on Runners, none at 0 (src/nav/sidebar.ts). It is
// the badge alone: it never adds to the bell's badge, the tab's `(N)` or the favicon dot, and it raises
// no alert (no desktop notification, no chime): nobody is notified, the badge and the job are the
// signal. A failed read keeps the last count and marks the part unreadable.

/** How often the Runners part is read while the tab is visible. */
export const RUNNERS_MS = 15_000;

/** The Runners part: how many jobs wait for an answer, and whether its last read failed. */
export type RunnersPart = { count: number; unread: boolean };

export const EMPTY_RUNNERS_PART: RunnersPart = { count: 0, unread: false };

/** The part after a read that works: the count it read. */
export const runnersSeen = (count: number): RunnersPart => ({ count, unread: false });

/** The part after a read that fails: it keeps its count, unreadable. */
export const runnersFailed = (part: RunnersPart): RunnersPart => ({ ...part, unread: true });

/** Reads at once when the tab is visible, then every RUNNERS_MS through `tick`, which resolves true to
 * keep going (false once the person is signed out, which ends the polling, the first read included). A
 * hidden tab rests, and reads at once when it shows again. Returns the stop function. */
export function pollRunners(tick: () => Promise<boolean>, doc: VisibilityDoc): () => void {
  const stop = poll(tick, doc, RUNNERS_MS);
  if (doc.visibilityState === 'visible') void tick().then((more) => { if (!more) stop(); }, () => undefined);
  return stop;
}
