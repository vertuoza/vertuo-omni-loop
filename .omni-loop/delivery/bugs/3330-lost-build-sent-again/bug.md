# Bug 3330: a mission's lost product build is repaired instead of sent again, and the repair cannot read the lost job

## Triage

- **Domain:** missions: the supervisor's reading of a product PRD's build end (`apps/omni-app/src/missions/supervisor.ts`), and the runner's reads (`omni runner`, `/omni:repair`)
- **Risk:** medium — a mission at Works alone whose product PRD build loses its runner stops on that PRD and waits on a person; workaround: a person sends the build again by hand (Jev, 0.88)
- **Regression:** new bug — no evidence this ever worked: a lost `/omni:ultra-yolo` build was never resumed (the database resumes yolo, yolo-fix, wave, do-work, pr-care and bug-fix only); since #3313 it went to repair, before it waited on a person

## Reproduction

- **File:** `apps/omni-app/src/missions/supervisor.product-lost.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected { state: 'repairable', k: 1, …(2) } to deeply equal { state: 'startable', run: 2 }

## Fix

A product PRD's build that its runner lost (failed with reason `runner lost`, `the worktree could not be made` or `the tmux session could not be started`, no spend or rate limit) is no longer read as a failure: the mission sends the build again as its next run, at Works alone while its lost builds number at most `mandate.resumes`, below it once, and only past that goes to repair. A new `omni runner log <job>` reads any job of the workspace through the app's lines route, which now also answers the job's line and reason, and prints its status, reason, line and last 200 log lines with secrets masked; `/omni:repair` reads the failed job with it and classes a lost job as `flake`, never `person`.

## Guard

`apps/omni-app/src/missions/supervisor.product-lost.test.ts` replays mission #3319's shape (run 1 lost, a repair that read `person`) and fails when the next wake does not send run 2; `kit/bin/commands/runner.test.ts` › `omni runner log` fails when a job cannot be read from another runner or a secret is printed in clear.

## Mutation

mutation: no changed core file against origin/main (f36bd747): nothing to mutate
