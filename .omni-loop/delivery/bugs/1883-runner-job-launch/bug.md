# Bug 1883: a job sent to a runner never runs

## Triage

- **Domain:** runners (PRD 1830): the kit's launcher (`kit/lib/launch/launch.ts`), `omni runner` (`kit/lib/runner/`) and the `next` route (`apps/galaxy/src/runners/`)
- **Risk:** high — every job sent to a runner dies at once, stays Running for up to 3 hours, and a runner's `next` call is sometimes cut off with a 504; Send to terminal does nothing, with no workaround but running the line by hand
- **Regression:** new bug — no evidence this ever worked: the first job a runner took, `/omni:pr-care 1737` on nimbus-agents, never ran

## Reproduction

- **File:** `kit/lib/launch/launch.test.ts`
- **Red:** × runs itself for runner and its jobs, which start in a worktree whose bin cannot run before its install (PRD 1830) — AssertionError: expected { kind: 'handover', …(1) } to deeply equal { kind: 'self' } — and, in `kit/bin/commands/runner.test.ts`: × fails a job whose session ends before it writes its exit code, at once, not after the timeout; × reads a tmux session as alive while a pane runs, and as ended once every pane is dead or the session is gone

## Fix

A job's wrapper, `omni runner job`, starts in the job's fresh worktree, and the launcher handed over to that worktree's own bin, which cannot load before the worktree's install (`Cannot find package 'yaml'`): the launcher now never hands `runner` over, so a runner and its jobs run as the runner's own copy. A session that dies without an exit-code file is now failed at once (`Terminal.alive`, read from tmux's `pane_dead`) instead of after `--timeout`, and `next` holds 40 s instead of 50 s, well under the route's 60 s limit.

## Guard

The reproduction is the guard: three unit tests, each failing on the default branch's code and passing here — the launcher's decision for `runner` and `runner job`, a job whose session dies without an exit code, and `tmuxTerminal().alive` on a live pane, a dead pane and a missing session.

## Mutation

mutation: no changed core file against origin/main (252ea5bd): nothing to mutate
