# Bug 3366: the Supervisor reports jobs the 48 h sweep expired as a same-failure bug

## Triage

- **Domain:** the Supervisor's checks (`apps/omni-app/src/supervisor/checks.ts`, `failureGroups`)
- **Risk:** medium — every batch of jobs the 48 h sweep expires raises a high "N jobs failed with the same reason" bug notification; Not a problem dismisses it
- **Regression:** yes — #3348 (omni-loop-35) made expired queued jobs end failed with the reason `Expired: no runner took it in 48 h`

## Reproduction

- **File:** `apps/omni-app/src/supervisor/checks.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ { …(9) } ] to deeply equal []`

## Fix

The same-failure check grouped every failed job of the last 6 h by reason and by last line, so the jobs the sweep expired on purpose made a "same failure" bug. `failureGroups` now leaves out a failed job whose reason starts with `Expired:`.

## Guard

The reproduction is the guard: four jobs expired by the sweep within 6 h raise nothing.

## Mutation

pending
