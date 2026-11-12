// The functions `/api/inngest` serves: none. The last one, the main watch (PRD 2410), is a job of the ledger since PRD
// omni-loop-4 s4 (./main-watch/main-watch.ts), which `/api/github` adds and wakes, so it can never run on both. Before it
// came the retro with its day-14 run (PRD 72, s3), the knowledge harvest (PRD 82, s2), the knowledge pack (PRD 2676), the
// four pull-request checks (PRD 2688), the pr-stats collector and the hourly escalation sweep (PRD omni-loop-3), the
// fix row stamp, the fleet board, the canon buttons and the server event (PRD omni-loop-3 s3, s4): each is a job of the
// ledger, run by the worker (./jobs/pr-checks.ts). The `inngest` package, its client and the route stay until PRD
// omni-loop-5 removes them.

/** The functions `/api/inngest` serves: none. */
export function appFunctions(): never[] {
  return [];
}
