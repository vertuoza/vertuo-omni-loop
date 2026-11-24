# Bug 3277: the app refuses its own /omni:tech-review jobs and blocks the runner

## Triage

- **Domain:** runners: the app's job contract (`apps/galaxy/src/runners/runners.contract.ts`)
- **Risk:** critical — any mission at Works alone that reaches an Architect review blocks every runner that claims the job: no job runs for any repository of the workspace until the job is ended by hand
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/runners/runners.fleet-lines.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected false to be true // Object.is equality`

## Fix

The job contract the runner's next call parses accepted a runner skill's line or one of the App's own, never a fleet's, so a claimed `/omni:tech-review` job threw and `GET /api/runners/next` answered 500 on every call. It now also accepts a fleet's line in its one shape (`isFleetLine`), and a person's Send still refuses it.

## Guard

none — the reproduction is the cheap check that would have caught it, a unit test that a fleet's job reaches the runner

## Mutation

mutation: no changed core file against origin/main (d06e3181): nothing to mutate
