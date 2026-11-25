# Bug 3288: a runner job ends done while its session still waits on its background work

## Triage

- **Domain:** runner (`kit/lib/runner/`: the job process `job.ts` and the `claude` agent)
- **Risk:** medium — an unattended build on a runner ends `done` half-way whenever a long test or lint run goes to the background, so a mission sends the PRD to a person; the workaround is to run the job again by hand. (Jev, 0.86)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/runner/job.wake.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ [ …(5) ] ] to have a length of 2 but got 1`

## Fix

`claude -p` exits 0 as soon as a turn ends, even when that turn ended waiting on a command the shell had moved to the background past its timeout; the exit stops that command, and the job ended `done` with no hand-off. The `claude` agent now reads such a run as waiting (its last words wait on background work or a notification, or wait while a backgrounded command never reported its end), and the job process resumes the same session with `--resume` and a message saying so, at most three times, each in the job's log; a session still waiting after the third fails the job naming why. `/omni:do-work` also runs its preflight and checks in the foreground.

## Guard

`kit/lib/runner/agents/claude.waiting.test.ts` pins what reads as waiting (and what never does, such as a turn waiting for a person's answer on Omni), and `kit/lib/runner/job.wake.turnover.test.ts` pins the resume on a runner with accounts; both fail on the default branch's code, which has no `waiting` reading.

## Mutation

mutation: no changed core file against origin/main (3b0cef07): nothing to mutate

## Still open

- apps/galaxy/src/business/reveal-render.test.ts fails on main today: the saved reveal still renders the 'business-found' check rows ('not seen since 30 Sep'), so the test looks date-dependent.
