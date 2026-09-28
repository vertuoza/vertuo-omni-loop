# Plan: Kit works in repos with a file list over 1 MB

PRD #433, spec in `spec.md` beside this plan. Built on the feature branch `feat/large-repo-file-list`
into `main` (`Closes #433`), through sub-PRs from `feat/large-repo-file-list--<slice>` into the
feature branch (`Part of #433`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `trackedFiles` lists any repository size with `-z` and an optional folder, `check knowledge` lists only its folder, and the bundle is rebuilt | `kit/lib/check-report` `kit/bin/commands/check.mjs` `kit/bin/omni.test.mjs` `kit/dist/` | — | 1 |

Shared ground: none. There is one slice, and `kit/lib/delivery/` is left alone because `ship`
keeps calling `trackedFiles(ctx)` unchanged.

## Per slice: done when

**s1**

- `kit/lib/check-report.test.mjs` exists, and on a temporary git repository whose `git ls-files`
  output is over 1 048 576 bytes, `trackedFiles(ctx)` returns every tracked file, sorted. On
  today's `trackedFiles`, the same test fails with `ENOBUFS`.
- A tracked `notes/café plan.md` comes back from `trackedFiles(ctx)` exactly as written.
- `trackedFiles(ctx, 'docs')` returns the files under `docs/` and none under `docs-old/`.
- `check knowledge` calls `trackedFiles(ctx, <knowledge root>)`, and its existing tests pass
  unchanged.
- `kit/lib/delivery/ship.test.mjs` passes unchanged.
- `kit/dist/omni.mjs` is rebuilt, and `kit/test/dist.test.mjs` passes.
- `pnpm test` is green.
