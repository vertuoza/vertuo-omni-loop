# Bug 2168: a job stuck at Starting cannot be cancelled

## Triage

- **Domain:** Runners — job cancel (`apps/galaxy/src/runners/`)
- **Risk:** medium — a member whose job stays Starting, its runner never reporting on it, cannot end it: Cancel only asks, then hides, and the job holds a runner slot; the only workaround is stopping the runner for 90 s so the job is marked lost. (Jev, 0.84)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/runners/runners.service.test.ts`
- **Red:** `× ends a Starting job at once, though its runner, still checking in, never reports on it (#2168)` — `AssertionError: expected { …(20) } to match object { status: 'cancelled', …(2) }`; `× keeps Cancel on a Starting job whose cancel was already asked, so it never stays stuck (#2168)` — `AssertionError: expected false to be true`

## Fix

Cancel on a claimed (Starting) job only set `cancel_requested` and waited for its runner's next report, then the page hid Cancel. A runner that errored on the job but kept checking in never reported on it, and was never marked lost, so the job stayed Starting for good. Now a cancel ends a queued or Starting job at once, as it does a queued one (a runner reporting on it later gets 409 and stops it); a running job still waits for its runner, and the page keeps Cancel on a Starting job, which also frees the jobs already stuck with a cancel asked.

## Guard

The two reproduction tests: a service test that a Starting job's cancel ends it at once, and a page-model test that Cancel stays on a Starting job whose cancel was asked.

## Mutation

mutation: no changed core file against origin/main (bd35c85d): nothing to mutate
