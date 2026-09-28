---
prd: 433
title: Kit works in repos with a file list over 1 MB
blocked-by: none
spec: file
---

# Kit works in repos with a file list over 1 MB

**Date:** 2026-09-28 · **PRD:** #433 · **Touches:** `kit/lib/check-report.mjs` (`trackedFiles`), its
two callers (`kit/bin/commands/check.mjs`, `kit/lib/delivery/ship.mjs`), and the committed bundle
`kit/dist/omni.mjs`. No change to config, skills, the apps or the database.

## Problem

A colleague installed the kit in a large repository, and `omni check knowledge` crashed. The
crash also breaks everything that runs it: `omni check all`, `/omni:invade` and `/omni:brainstorm`.

`trackedFiles(ctx)` in `kit/lib/check-report.mjs` runs `git ls-files` through `execFileSync`
without a `maxBuffer`. Node's default is 1 MB (1 048 576 bytes) of stdout. That repository's file
list is about 1.1 MB, so Node kills git and throws `ENOBUFS`. The error reaches the user as a
crash, not as a check result.

`trackedFiles` has two callers:

- `check knowledge` (`kit/bin/commands/check.mjs`), which keeps only the `.md` files under the
  knowledge folder.
- `omni ship` (`kit/lib/delivery/ship.mjs`), which rewrites the PRD's inbox path to its shipped
  path in every tracked `.md`, `.html`, `.yml`, `.yaml` and `.json` file. So the same repository
  would also fail at the end of its first delivery, when `/omni:yolo` ships.

## Solution

1. **No output ceiling.** `trackedFiles` runs `git ls-files -z` with a `maxBuffer` large enough
   for any real repository (256 MiB), and splits on NUL. With `-z`, git does not quote paths that
   contain spaces, quotes or non-ASCII characters, so every path comes back exactly as git stores it.
2. **An optional folder.** `trackedFiles(ctx, dir)` takes an optional folder and passes it to git
   as a pathspec (`-- <dir>/`). With no folder it lists the whole repository, as it does today.
3. **`check knowledge` lists only its folder.** It calls `trackedFiles(ctx, root)` and keeps its
   `.md` filter. The output then grows with the size of the knowledge folder, not of the repository.
4. **`omni ship` is unchanged.** It still needs the whole repository, because its link rewrite runs
   across all of it. Point 1 is enough for it.
5. **The bundle is rebuilt.** `kit/dist/omni.mjs` is regenerated in the same change, so
   `kit/test/dist.test.mjs` stays green and the next release (`v0.0.N`) carries the fix. The
   colleague's repository picks it up through `omni update`.

## Decisions

- **One fix, in the shared helper.** The other kit git calls (the `diff`, `log` and `ls-tree`
  calls in `status`, `statusline`, `phase0` and `lib/git.mjs`) list only the delivery or knowledge
  folders, or one branch's changes. They stay far below 1 MB, and they are left unchanged.
- **256 MiB, not `Infinity`.** A git that runs away still stops with a clear `ENOBUFS` error
  instead of filling memory. 256 MiB is roughly two million long paths.
- **`-z`, not newline splitting.** The larger limit alone fixes the crash, but the output is
  being read differently anyway, and without `-z` git quotes unusual paths (`"caf\303\251.md"`),
  which then match nothing.
- **The colleague waits for the release.** The person chose to fix upstream first, not to patch
  the vendored bin in the large repository.

## User stories

- As someone installing the kit in a large monorepo, I want `omni check all` to grade my
  repository instead of crashing, so the install and my first brainstorm go through.
- As someone shipping a PRD in that repository, I want `omni ship` to move the PRD and rewrite its
  links, so `/omni:yolo` can finish.

## Scope

In scope: `trackedFiles` (limit, `-z`, optional folder), `check knowledge`'s call, their tests, the
rebuilt bundle.

Out of scope: every other git call in the kit; streaming the file list; any change to what
`check knowledge` or `ship` grade or rewrite.

## Test seams

Per `omni kb show testing`: tests sit beside the code, run on fixture repositories from
`kit/test/fixture.mjs`, and never call GitHub.

- `kit/lib/check-report.test.mjs` (new), on a real temporary git repository (`makeRepo({ git: true })`):
  - **Over 1 MB.** Enough tracked files that `git ls-files` prints more than 1 048 576 bytes
    (for example 6 000 files, each with a path over 180 characters, added with one
    `git add`). `trackedFiles(ctx)` returns every one of them, sorted. This test fails on today's
    code with `ENOBUFS`.
  - **Unusual paths.** A tracked file named with a space and a non-ASCII character
    (`notes/café plan.md`) comes back exactly as written.
  - **One folder.** `trackedFiles(ctx, 'docs')` returns only the files under `docs/`, and not a
    `docs-old/` sibling.
- `kit/bin/omni.test.mjs` or the existing `check knowledge` test: `check knowledge` still passes and
  fails on the same fixtures as today (no behaviour change).
- `kit/lib/delivery/ship.test.mjs`: unchanged and green.
- `kit/test/dist.test.mjs`: green, which proves the bundle was rebuilt.

## Risks

Per `omni kb show releasing`: a merge to `main` changes the kit bundle `kit/dist/omni.mjs` that the
one-line install and `omni update` hand out, and it is released as the next `v0.0.N`. Nothing else
is published: no migration and no app change.

- **Risk:** a caller that relied on newline-quoted paths. None does: both callers compare paths
  against plain folder prefixes and extensions.
- **Rollback:** revert the feature PR's merge commit. The next release hands out the old bundle
  again, and repositories whose file list is over 1 MB go back to crashing.

## Acceptance criteria

Acceptance scenarios are off in this repository, so each criterion below becomes an ordinary test.

1. In a repository whose `git ls-files` output is over 1 MB, `trackedFiles(ctx)` returns every
   tracked file, sorted, and does not throw.
2. A tracked path containing a space and a non-ASCII character is returned exactly as written.
3. `trackedFiles(ctx, 'docs')` returns the files under `docs/` only.
4. `omni check knowledge` lists only the knowledge folder, and passes and fails on the same
   fixtures as before.
5. `omni ship` passes its existing tests unchanged.
6. `kit/dist/omni.mjs` is rebuilt, and `kit/test/dist.test.mjs` passes.
7. `pnpm test` is green.
