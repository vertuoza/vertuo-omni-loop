# Bug 2621: the runner gives up on a health report the server is still storing

## Triage

- **Domain:** runner health reports (`kit/lib/runner/api.ts`)
- **Risk:** low — The runner log shows a false alarm for about 0.5% of health reports; nothing breaks, because the next report goes out 15 s later and a runner counts as lost only after 90 s of silence. (Jev, 0.93)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/runner/api.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected "timeout" to be called with arguments: [ 20000 ]`

## Fix

The runner waited 5 s for a health report, while the app can take up to 16.8 s at busy moments and still answers 200, so the log said a report was lost when it was not. The runner now waits 20 s. The next report goes out once the wait ends, so two never overlap.

## Guard

none — the reproduction is the check: a fixed wait, held by a unit test; nothing cheaper would have seen the app's production timings

## Mutation

mutation: no changed core file against origin/main: nothing to mutate
