# Bug 1912: a runner job stops 10 minutes into its first wave and reads Done

## Triage

- **Domain:** runners (`kit/lib/runner/`, PRD 1830)
- **Risk:** medium — every person who sends `/omni:yolo` or `/omni:wave` to a runner gets a job that stops in wave 1 and reads Done; the workaround is setting the variable in the runner machine's Claude settings by hand (Jev, 0.56)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/commands/runner.test.ts`
- **Red:** `AssertionError: expected { Object (PATH) } to match object { …(1) }` (starts every job session so that claude waits for its background agents to end (bug 1912))

## Fix

`/omni:wave` starts one background agent per slice and ends its turn while they work. Under `claude -p`, claude stops background work 10 minutes after the last turn and exits 0, so the job ended Done with its slices half built (job 631c499f on vertuo-agents, PRD 1904). Every job session now starts with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` (`kit/lib/runner/runner.ts`), so claude waits for its agents to end; the runner's own timeout still bounds the job.

## Guard

The reproduction is the guard: it fails whenever a job session starts without `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, and the token tests now list the session's variables exactly, the new one included.

## Mutation

mutation: no changed core file against origin/main (ba1c9010): nothing to mutate
