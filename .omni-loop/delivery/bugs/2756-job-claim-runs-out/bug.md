# Bug 2756: app jobs fail with "its claim ran out on its last try"

## Triage

- **Domain:** the Omni GitHub App's job ledger and worker (`apps/omni-app/src/jobs/`), and the functions that run it (`/api/github`, `/api/server-event`, `/api/jobs-sweep`)
- **Risk:** medium — workspaces get late or missing pull-request checks and no escalation ask at all; most jobs pass on a later try and a failed one can be replayed, but `/api/health` stays at `jobs: late`, so a real jam would go unseen (Jev, 0.47)
- **Regression:** yes — v0.0.599..v0.0.600 (first seen 2026-11-09 16:12 UTC, none before): #2677 runs the worker, with its 240-second budget, in `waitUntil` inside `/api/github`, whose function Vercel stops at 60 seconds

## Reproduction

- **File:** `apps/omni-app/src/jobs/worker.host.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ 1, 1, 1, 1, 1, 1 ] to have a length of 1 but got 6` (a run in a 60-second function kept claiming after 45 seconds) and `AssertionError: expected [] to have a length of 1 but got +0` (a job still running near the function's end was never given back)

## Fix

The worker never knew when the function running it would be stopped: it claimed jobs for its own 240 seconds inside 60-second webhook functions, and a job still running when Vercel stopped the function lost its claim, 5 minutes later, as a `lost` try; lost on its last try, the job failed. Now each route tells `runDue` when its function ends (`endsAt`, from its `maxDuration`): the worker claims only with 20 seconds left, and gives a job still running 5 seconds before the end back as `waiting` a minute, its try kept. The escalation sweep saves each repository as a step, so a try given back carries on from the next repository.

## Guard

`apps/omni-app/src/jobs/function-ends.test.ts`: each function that runs the worker states its end as `vercel.json` does, the shortest leaves time to claim and finish, and every `runDue` call in the App passes `endsAt`. It fails on main's routes (3 of 5 red) and passes here.

## Mutation

mutation: no changed core file against origin/main (f562fc36): nothing to mutate
