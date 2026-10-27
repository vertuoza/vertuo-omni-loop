# Bug 2523: kit/bin/worktrees.test.ts fails 20 of 29 tests on macOS with the default TMPDIR

## Triage

- **Domain:** kit test harness · the fixture of `kit/bin/worktrees.test.ts` (`omni worktrees`, PRD 2485). The command is right: git lists resolved worktree paths, `lsof` reports resolved working directories, and the engine resolves the path it is given
- **Risk:** medium — every developer and agent on a Mac sees the full `pnpm test` go red on this file and spends one attempt per slice; pointing `TMPDIR` at a real path is the workaround (Jev, 0.75)
- **Regression:** new bug — no evidence this ever worked: the test and the command arrived together in ed5e8dd65 (#2487), and the file has failed on macOS since

## Reproduction

- **File:** `kit/bin/worktrees.test.ts`
- **Level:** the command through `main()` on a temporary repository with real worktrees, on macOS with the default `TMPDIR` (`/var/folders/…/T/`)
- **Red:** Tests  20 failed | 9 passed (29) — AssertionError: expected 'kept /private/var/folders/…/T/omni-vk0K0i/.claude/worktrees/slice · uncommitted' to be 'kept /var/folders/…/T/omni-vk0K0i/.claude/worktrees/slice · uncommitted'

## Fix

The test's fixture built its repository and worktree paths from `os.tmpdir()` as they came, and on
macOS that folder sits under the `/var` symlink to `/private/var`. git lists the resolved paths, so
every assertion that names a worktree compared `/var/…` with `/private/var/…`; Linux, whose temporary
folder is a real path, never saw it. The fixture now hands its tests the real path of the root and of
every worktree it adds, as git lists them. The assertions and the `omni worktrees` command are
unchanged.

## Guard

A test of the fixture that points `TMPDIR` at a symlink, on any system, and checks that the root and
the worktrees it hands back are the paths `git worktree list` prints. It fails on `main`'s fixture
even where `TMPDIR` is a real path (the Linux CI case: 1 failed, 29 passed), and undoing either half of
the fix (the root, or the worktree `add` returns) turns it red again. A second test removes a worktree
named by a path through a symlink, so the command's own resolving of the path it is given stays
covered on every system, which the macOS runs did only by accident before.

## Mutation

mutation: no changed core file against origin/main (a8c3d097): nothing to mutate

The one changed file is a test, outside the delivery core Stryker mutates. Both halves of the fix were undone by hand, one at a time, and the guard went red on each.
