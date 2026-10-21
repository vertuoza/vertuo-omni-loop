---
prd: 1911
title: omni runner cleans up after itself
blocked-by: none
spec: file
phase0: server
---

# omni runner cleans up after itself

**Date:** 2026-10-14 · **PRD:** #1911 · **After:** PRD 1830 (runners), PRD 1904 (live job logs,
which changes the same runner files) · **Touches:** `kit/lib/runner/` (a new `sweep.ts`, and
`runner.ts` where a job ends), `kit/bin/commands/runner.ts` (the `--keep-logs` flag) and their
tests, the kit README's runner section.

## Problem

Each job `omni runner` runs creates a local branch, `agent/job-<id>`, and a worktree,
`~/wt/<repo>-job-<id>`, and writes `~/logs/job-<id>.*`. When a job ends, the runner removes its
worktree and nothing else. The branch stays, the worktree's record can stay (a job like
`/omni:yolo` makes worktrees of its own inside it), and the logs stay forever. A worktree whose job
died with the runner is never removed. On nimbus-agents, after one day, six `agent/job-*` branches
and a prunable worktree record were left. A runner left running for weeks fills its disk.

## Solution

**When a job ends,** after the runner removes the job's worktree as it does today, it also:

- deletes the job's local branch `agent/job-<id>`, unless that branch was pushed;
- runs `git worktree prune` in the job's checkout.

**The sweep** (`kit/lib/runner/sweep.ts`), once when the runner starts and then every hour while it
runs:

- removes each `~/wt/<repo>-job-<id>` folder whose job is not running, then runs
  `git worktree prune` in each checkout under `--repos`;
- deletes each local `agent/job-*` branch in those checkouts whose job is not running, unless it was
  pushed;
- deletes each `~/logs/job-<id>.*` file older than `--keep-logs` days (default 14) whose job is not
  running;
- prints one line saying what it removed and how much space that freed, for example
  `swept: 3 worktrees, 6 branches, 12 log files · 412 MB freed`. A sweep that removed nothing prints
  nothing.

A branch counts as **pushed** when it has an upstream, or when `origin` has a branch of that name.
A job is **running** when the runner holds it in a slot.

`omni runner` gains `--keep-logs <days>`, a whole number of 1 or more, default 14.

## Decisions

- **Inside the runner, not a system cron** (the person's choice in the design talk): the runner
  already runs all the time, so a sweep in its loop works on any server with nothing else to set up.
- **What it may delete** (the person's brief): only `~/wt/<repo>-job-<id>` folders, `~/logs/job-<id>.*`
  files, and local `agent/job-*` branches. `~/logs/runner.log`, other folders and other branches are
  never touched.
- **Pushed means an upstream or a branch on origin** (assumed, stated in the design and approved):
  either one keeps the branch.
- **The voice's objection, accepted.** F-E Developer: a job that deletes on a timer is how work gets
  lost. A pushed branch and a running job's files surviving the sweep are their own tests and
  acceptance criteria.
- **Built after PRD 1904** (the person's brief): it changes `kit/lib/runner/runner.ts` and the runner
  command, so this builds once 1904 has merged. The front matter says `blocked-by: none` only because
  `omni check inbox` refuses a PRD with no folder on `main` yet, and 1904's is still on its feature
  branch: send `/omni:yolo 1911` once #1906 has merged.
- **No proof video** (the person's answer).

## User stories

1. As the person running `omni runner` on a server, I leave it running for weeks and its disk stays
   flat.
2. As the same person, I read one line saying what each sweep freed.
3. As the same person, I keep logs longer with `--keep-logs 30`.

## Scope

In: the end-of-job cleanup, the sweep and its hourly timer, `--keep-logs`, their tests, and the
README lines.

Out: cleaning anything on the Omni page (job rows stay in its history), pruning the package
manager's store, `git gc`, and starting the runner on boot.

## Test seams

Every test runs on fixtures: none calls GitHub, Claude or the Omni page (testing playbook).

| risk | test |
|---|---|
| a job's branch and records left behind | `runner.test.ts`, through `main()` with the fake terminal: once a job ends, `agent/job-<id>` is gone and `git worktree list` shows no stale record |
| a pushed branch deleted | `sweep.test.ts`: an `agent/job-*` branch with an upstream, and one present on the fixture's origin, both survive |
| a running job's files deleted | `sweep.test.ts`: a job marked running keeps its worktree, branch and logs, however old |
| deleting outside its lane | `sweep.test.ts`: `runner.log`, a folder in `~/wt` not named `<repo>-job-<id>`, an older file in `~/logs` not named `job-<id>.*`, and a branch not under `agent/job-` all survive |
| logs kept the right number of days | `sweep.test.ts`, with a fixed clock: files 13 and 15 days old against the default, and against `--keep-logs 30` |
| the report line | `sweep.test.ts`: the counts and space freed; no line when nothing was removed |
| the hourly timer | `runner.test.ts`: a sweep at start and one after each hour, with the injected sleep and clock |
| a bad flag | `runner.test.ts`: `--keep-logs 0`, `--keep-logs x` refused with a usage line |

## Risks

- **What merging publishes:** the next kit release; a runner picks it up after an update and a
  restart, and its first sweep then removes what earlier runs left.
- **Deleting the wrong thing:** each deletion is limited to the three names above and skips running
  jobs and pushed branches, each held by a test.
- **Rollback:** revert the pull request. Nothing it deleted comes back, but nothing it may delete
  holds work: job branches are never pushed and job worktrees are removed at the end today already.
- The locked laws: none touched.

## Acceptance criteria

1. When a job ends, its `agent/job-<id>` branch is gone, unless it was pushed, and its checkout has
   no stale worktree record.
2. A sweep runs when the runner starts and again every hour.
3. A sweep removes every job worktree, `agent/job-*` branch and job log file older than
   `--keep-logs` days whose job is not running, and prints one line with the counts and the space
   freed; when it removed nothing, it prints nothing.
4. A pushed `agent/job-*` branch, and every file and branch of a running job, survive every sweep.
5. Nothing outside `~/wt/<repo>-job-<id>`, `~/logs/job-<id>.*` and local `agent/job-*` branches is
   ever deleted, `~/logs/runner.log` included.
6. `--keep-logs <days>` takes a whole number of 1 or more, default 14, and refuses anything else with
   a usage line.
7. The kit README's runner section says what the runner cleans up and names `--keep-logs`.
