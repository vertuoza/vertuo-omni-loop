# Bug 3244: the runner cuts a committee's vote line at 500 characters, so the vote is lost

## Triage

- **Domain:** runners: a job's readable log (`kit/lib/runner/steps.ts`), read back by missions
- **Risk:** medium — every Works-alone mission whose committee writes full reasons loses the vote and sends each PRD to a person; the workaround is approving each PRD by hand
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/runner/steps.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected undefined to deeply equal [ 'yes', 'yes', 'yes' ]`

## Fix

The runner cut every readable log line at 500 characters, and the App reads a mission job's record line back from those lines, so a committee vote with three full reasons arrived cut and read as no vote. A line starting with a record prefix the App reads (`omni committee:`, `omni pm:`, `omni retro:`, `omni repair:`) now keeps up to 8,000 characters; every other line is still cut at 500.

## Guard

none — the reproduction is the cheap check that would have caught it, a unit test that a full-length committee record survives the runner's readable log

## Mutation

mutation: no changed core file against origin/main (fe0a3090): nothing to mutate
