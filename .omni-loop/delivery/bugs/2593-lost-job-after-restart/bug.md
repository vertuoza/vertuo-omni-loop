# Bug 2593: a job sent right after a runner restarts is lost

## Triage

- **Domain:** runners app, the check-in that hands a runner its next job (`apps/galaxy/src/runners/runners.service.ts`, `next`)
- **Risk:** medium — a job sent in the 40 s after a runner restarts (every runner update) is lost and ends Runner lost; the person sends it again
- **Regression:** new bug — no evidence this ever worked (the held check-in came with PRD 1830)

## Reproduction

- **File:** `apps/galaxy/src/runners/runners.service.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected { …(7) } to be null

## Fix

`GET /api/runners/next` holds a runner's check-in up to 40 s and claims any job that arrives, but never
noticed its runner had hung up. A runner restarted mid check-in left that check-in running, and a job
sent before it ended was claimed for the runner and answered to nobody. The route now passes its
request's signal to the check-in, which claims nothing more once it aborts.

## Guard

The reproduction: a unit test of the held check-in that fails when a job arriving after the runner hung up
is still claimed.

## Mutation

mutation: no changed core file against origin/main (a0cc27c2): nothing to mutate
