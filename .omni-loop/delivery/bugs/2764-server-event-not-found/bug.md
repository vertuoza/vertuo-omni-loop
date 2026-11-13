# Bug 2764: server-event job fails on a target pull request GitHub answers Not Found

## Triage

- **Domain:** omni-app: the `server-event` job of the job ledger (`apps/omni-app/src/server-event/job.ts`)
- **Risk:** medium — after an approval, a void or an outbox item settled on the server, no target pull request of that product PRD gets its checks re-posted and `/api/health` reads `jobs: late`; workaround: a push to the pull request re-runs its checks.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/server-event/recheck.test.ts`
- **Level:** unit
- **Red:** `FAIL  apps/omni-app/src/server-event/recheck.test.ts > server-event — a target pull request GitHub answers Not Found (bug #2764) > leaves out a pull request GitHub answers 404 or 410, re-checks the others, and says which in the log` — `Error: Not Found - https://docs.github.com/rest/pulls/pulls#get-a-pull-request`

## Fix

The job read each target pull request from GitHub and threw on any failure, so one 404 (a pull request gone, or in a repository the App cannot read) spent its 4 tries and failed the whole job. It now leaves out a pull request GitHub answers 404 or 410 for, says so in the log, and re-checks the others; with none left it ends `skipped`, saying how many were left out. A 5xx, or any other failure, is still thrown and retried.

## Guard

Three unit tests in `recheck.test.ts`: a 404 or 410 on one target leaves it out and re-checks the other, a 404 on every target ends `skipped` with why, and a 500, 502 or 503 still throws so the worker retries it. The first two fail on `main`'s `job.ts`.

## Mutation

mutation: no changed core file against origin/main (13e9767f): nothing to mutate
