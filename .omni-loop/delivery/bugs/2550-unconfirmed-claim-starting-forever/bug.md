# Bug 2550: a runner job whose hand-over fails stays Starting forever

## Triage

- **Domain:** runners, a job's claim and hand-over (`apps/galaxy/src/runners/runners.service.ts`, `next`)
- **Risk:** medium — whoever sent the job sees it Starting forever, nothing runs it, and it holds one of the runner's slots; the workaround is to cancel it and send it again (Jev, 0.94)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/runners/runners.service.test.ts`
- **Level:** unit (the runners' service on the fake store, with a fixed clock)
- **Red:** Tests  2 failed | 266 skipped (268) — AssertionError: expected undefined to be '00000000-0000-4000-8000-001830020002'

## Fix

`next` stores the claim, then answers the runner; when that answer is lost (the app's 504s of
2026-10-27), the runner polls on without the job. A job was ended `runner lost` only when its runner
went silent for 90 s or registered again, and a polling runner is neither, so the job stayed claimed
(Starting) forever and held a slot. Now a job still claimed 10 minutes after its claim, never reported
running, ends `runner lost` at the same marks as a silent runner's jobs (every `next`, job report,
health report and Runners page read), and tells its link. Nothing is retried, as before: the person
sends it again from the Runners page.

## Guard

The reproduction is the guard: the service test ends a claim left unstarted past 10 minutes and frees
its runner's one slot for the next job, keeps one under 10 minutes, and pings its link; a repository
test pins the query (`status = claimed`, `claimed_at` before the cutoff).

## Mutation

mutation: no changed core file against origin/main (bc5ec7ab): nothing to mutate — the changed files are in `apps/galaxy/`, outside the delivery core Stryker mutates.
