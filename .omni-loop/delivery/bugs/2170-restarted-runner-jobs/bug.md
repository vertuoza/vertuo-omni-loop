# Bug 2170: a restarted runner leaves its jobs stuck at Starting or Running

## Triage

- **Domain:** Runners — registration and lost jobs (`apps/galaxy/src/runners/runners.service.ts`)
- **Risk:** high — every job a runner held when it crashed or was restarted stays Starting or Running for good and keeps one of its slots, so after enough restarts the runner takes no work; a Running one cannot be cancelled, and the only way out is keeping the runner stopped for over 90 s while someone reads the Runners page. (Jev, 0.61)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/runners/runners.service.test.ts`
- **Red:** `× ends the jobs a restarted runner held as runner lost, though it was silent for under 90 s (#2170)` — expected `["failed", "runner lost"]`, received `["claimed", null]` and `["running", null]`

## Fix

`omni runner` registers by name when it starts and gets the same runner id back, and `register` stamped the runner as seen without ending the jobs it held, so the 90 s "runner lost" rule never caught them: they stayed Starting or Running and kept the runner's slots. Now a runner that registers again first ends its own claimed and running jobs as `failed`, `runner lost` — a runner that registers has just started, so it holds none of them. Other runners' jobs and queued jobs are untouched.

## Guard

The reproduction: a service test that a runner registering again, after under 90 s of silence, finds its claimed and running jobs lost, another runner's job untouched, and its slot free for a queued job.

## Mutation

mutation: no changed core file against origin/main (6dbfd66b): nothing to mutate
