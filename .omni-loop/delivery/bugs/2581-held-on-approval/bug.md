# Bug 2581: a runner job held on its PRD's approval ends "Done" instead of "Held"

## Triage

- **Domain:** runners: how a job's ending is read from its log (`kit/lib/runner/log.ts`, `runOutcome`)
- **Risk:** medium — whoever sent a `/omni:yolo` job whose PRD waits for approval is told it ended Done (an older runner) or Stopped mid-way with "send it again" (today's), instead of Held; reading the job's log is the workaround
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/runner/log.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected 'stopped' to be 'held' // Object.is equality

## Fix

The runner read a yolo job's ending from its log's last line only, and called it held only when that line
was the `/omni:yolo <n>` hand-off. A run whose PRD waits for approval ends on the line `omni wait approval`
printed when it gave up, with the agent's own words under it, so it read Stopped mid-way (Done on a runner
before PRD 2375). Now a yolo job with no hand-off line is held when the session's last answer, the lines
after its last `Done:` line, holds a held line of its own: `held: …`, `… · held`, or `… · held, not failed`.

## Guard

The reproduction is the guard: unit tests of `runOutcome` on a log shaped like the job's, one per held
line, plus the two that stay `stopped` (a held line in an earlier answer, a held line only quoted in words).

## Mutation

mutation: no changed core file against origin/main (52c3caf1): nothing to mutate
