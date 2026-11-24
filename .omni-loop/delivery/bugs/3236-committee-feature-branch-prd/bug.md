# Bug 3236: the mission committee cannot find a PRD whose folder is only on its feature branch

## Triage

- **Domain:** missions: the committee's PRD lookup (`omni prd`, kit/lib/delivery)
- **Risk:** medium — a goal-only mission at Works alone sends every PRD its PM wrote to a person instead of a committee vote; the workaround is approving each PRD by hand on its page
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/commands/prd.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected 'omni prd: PRD 7 is in neither .omni-l…' to contain 'its folder is on origin/feat/quote: r…'`

## Fix

A mission's PM writes each PRD's folder on its own feature branch, never on the default branch, and the committee is sent the PRD's number alone, so `omni prd <n>` found nothing and named nothing. `omni prd` now names the remote feature branch whose inbox holds `<nnnn>-<topic>`, and the committee and yolo skills check that branch out and read the PRD there.

## Guard

none — the reproduction is the cheap check that would have caught it, a unit test of `omni prd` on a PRD whose folder is only on its feature branch

## Mutation

mutation: no changed core file against origin/main (991938cd): nothing to mutate

## Still open

- A runner job stays running after Claude's last message: the roadmap job of mission 3214 printed its record line at 06:09 and its Claude process exited only at 06:26.
- The runner's save of job 2e88de82 failed on `git add -A` with its worktree excludes, the job's folder was then removed, and the PM's five question items were lost.
- The runner logged 474 "the app is unreachable" lines (504s and timeouts on /api/runners) over its run log, the morning of 2026-11-24.
