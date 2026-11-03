# Bug 2592: omni runner follow cannot follow the job id omni runner send prints

## Triage

- **Domain:** runner — the terminal commands `omni runner send` and `omni runner follow` (`kit/bin/commands/runner-follow.ts`)
- **Risk:** medium — A person who sends a job from a terminal is not told how to follow it; workaround: run `omni runner follow <PRD>` by hand, or watch the Runners page. (Jev, 0.99)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/commands/runner.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected { code: +0, stdout: 'job-9\n', …(1) } to match object { code: +0, …(1) }` — send printed `job-9` and no follow line

## Fix

`omni runner send` printed only the job's id, which `omni runner follow` cannot take: it follows a PRD. Send now prints, after the id, `follow it: omni runner follow <n>` when the line names a PRD (`prdOfRunnerLine` in `kit/lib/runner/line.ts`, the same skills the Omni app reads a PRD from). A line that names no PRD (a bug fix, a repository's own skill) still prints the id alone: following such a job needs a read of one job by its id, which the app does not serve to the terminal yet.

## Guard

`apps/galaxy/src/runners/continue.test.ts`: the kit's `prdOfRunnerLine` reads the same PRD as the app's `prdOfLine` for every runnable skill, so the follow line send prints always finds the job; it goes red when either list of PRD skills changes alone (seen red with `prove` dropped from the kit's list).

## Mutation

mutation: no changed core file against origin/main (c60996e0): nothing to mutate
