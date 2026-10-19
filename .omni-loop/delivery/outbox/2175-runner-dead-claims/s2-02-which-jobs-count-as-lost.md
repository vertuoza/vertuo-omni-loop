---
id: s2-02-which-jobs-count-as-lost
prd: 2175
slice: s2
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

How does a runner know which of its jobs the app marked lost, so it can release their claims during its hourly clean-up?

## The decision, in plain words

A job counts as lost when its work folder is still on the machine while no slot of the runner holds it: that is what a runner that died or restarted leaves behind. A job that never started its session made no claim, so it releases nothing.

## The intro, for fun

The runner woke up from a restart and found a folder nobody was sitting at.

## The punchline, for fun

Whoever left it is not coming back, so their claims go back on the shelf.

## The options, in plain words

A. A. A job counts as lost when its work folder is left on the machine and no slot holds it.
B. B. The runner asks the app for the jobs it marked lost on this runner, and releases those.

## What I had to decide

Keep reading a lost job from the work folder left on the machine (A), or ask the app for the jobs it marked lost on this runner (B).

## What I did meanwhile

`strandedJobs` (kit/lib/runner/sweep.ts) lists the `~/wt/<repo>-job-<id>` folders of checkouts held whose job no slot holds; the sweeper (kit/lib/runner/runner.ts) reads them before the sweep removes them, then releases each, reason `runner lost`. The end path releases only when the job's session started (`live` is not null): a refused line, a repository not held, a worktree or plugin failure release nothing and make no `gh` call.

## What it costs to change later

B is a new runner route on the app (the jobs it marked lost for this runner, not yet released), its contract and service tests, and a call in the sweeper instead of `strandedJobs`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the hourly sweep calls the release for a job the server marked lost, but the runner has no route that tells it which jobs those are; the folder a job leaves is the only trace the runner itself holds.
- (author) A job whose folder was already removed (by hand, or by a sweep of a kit older than this PRD) is never released by the runner; the board's 240-minute quiet rule covers it.
