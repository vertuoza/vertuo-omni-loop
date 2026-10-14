# Plan: omni runner cleans up after itself

PRD #1911, spec beside this plan (`spec.md`). The feature branch `feat/runner-cleanup` merges into
`main` through the feature PR (`Closes #1911`); the one slice is a sub-PR from
`feat/runner-cleanup--s1` into the feature branch (`Part of #1911`). Blocked by PRD 1904: build it
once 1904 has merged, from a feature branch that has met `main`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The runner cleans up when a job ends and sweeps at start and every hour, with `--keep-logs`, their tests and the README lines | `kit/lib/runner/` `kit/bin/commands/runner` `kit/README.md` | — | 1 |

**Shared ground.** One slice, so none. `kit/dist/` is built: the slice rebuilds it only to test, and
the wave rebuilds it once after merging.

## Per slice: done when

**s1**
- When a job ends, its `agent/job-<id>` branch is deleted unless pushed, and `git worktree prune`
  runs in its checkout (`runner.test.ts`, through `main()`).
- `kit/lib/runner/sweep.ts` removes job worktrees, `agent/job-*` branches and job logs older than
  `--keep-logs` days whose job is not running, and prints one line with the counts and space freed,
  nothing when nothing was removed.
- `sweep.test.ts` shows survivors: a branch with an upstream, a branch present on origin, a running
  job's worktree, branch and logs, `runner.log`, and every other name in `~/wt`, `~/logs` and other
  branches; and log ages 13 and 15 days against the default and against `--keep-logs 30`.
- A sweep runs at start and after each hour (`runner.test.ts`, injected sleep and clock);
  `--keep-logs 0` and `--keep-logs x` are refused with a usage line.
- The kit README's runner section says what the runner cleans up and names `--keep-logs`.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` green.
