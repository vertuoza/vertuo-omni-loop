# Bug 3339: the runner never receives a mission's product build (--base-of), runners/next answers 500

## Triage

- **Domain:** runners: the job contract the app answers a runner's `next` with, fed by the missions' lines
- **Risk:** critical — every mission that builds a product PRD on its mission branches is blocked: the runner never receives the build, the job ends `runner lost` and is resent in a loop; no workaround
- **Regression:** new bug — no evidence this ever worked: the app's job contract never accepted the `=` of `--base-of` since #3142 started sending it

## Reproduction

- **File:** `apps/galaxy/src/runners/runners.base-of-lines.test.ts`
- **Level:** unit
- **Red:** `× reach the runner that claims the job: the build, into one repository's mission branch` — `expect(RunnerJobSchema.safeParse(job(line)).success).toBe(true)`: expected false to be true

## Fix

The app's job contract checked a claimed job's line with the rules of a person's Send, plus two hand-copied exceptions (the App's lines, the fleet's `tech-review`), so a mission's `/omni:ultra-yolo <key>-<n> --base-of <owner/repo>=<branch>` failed the runner's whole `next` with a 500. The contract now also accepts every line the kit's runner itself accepts (`checkRunnerLine`), so the two can no longer drift; Send keeps its own check. A claimed job the contract still cannot answer now ends failed with a reason, and the runner gets the next job instead of a 500. The kit's runner check also takes the stuck repair's `--jobs <j1>,…,<j5>` list, which both sides refused.

## Guard

`scripts/mission-lines-guard.test.ts` builds every line the mission code sends (builds, fixes, Reviewer, QA, committee, bug fixes, care, retros, repairs, stuck repair, the PM's and the Architect's lines, with and without `--base-of`) and asserts the kit's runner and `RunnerJobSchema` both accept it. On main it fails on the three `--base-of` lines and the stuck repair.

## Mutation

Mutation: not run — the machine is shared with two other agents' full runs; the changed core is covered by the guard and the unit tests

## Still open

- none
