---
form: verification
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@f886c74
  - vitest.config.ts@347b309
  - kit/test/dist.test.ts@c912f3a
  - apps/galaxy/package.json@7ae2649
  - .github/workflows/game.yml@d9f2da2
  - .github/workflows/supabase.yml@f937511
  - scripts/check-changed.ts@ad798a2
  - scripts/check-changed-steps.ts@8cca656
  - scripts/lint.ts@efc3f1b
  - scripts/lint-repository.ts@b154f4c
  - .github/workflows/checks.yml@2ee982c
terraformed: 2026-09-25
---

# Verification

Use this page when handing off changes: what must be green before a pull request, and before a push.

## The preflight
<!-- slot: preflight · required · by: terraform · verified: 2026-09-25 -->
`pnpm test` is the preflight, and the full preflight too: one vitest run over the whole workspace,
as `vitest.config.ts` includes it. Among its tests, `kit/test/dist.test.ts` fails when
`kit/dist/omni.mjs` differs from a fresh build: after a change to the kit's source or templates,
run `pnpm kit:build` and commit the bundle with it.

## Before every push
<!-- slot: before-push · optional -->
The loop has two speeds (PRD 1042).

**While iterating**, after each change and before a work-in-progress push, run
`pnpm check:changed --base origin/<feature branch>` from a slice's worktree
(`pnpm check:changed` alone measures from `origin/main`). It takes the files changed since the
merge-base of `HEAD` with that base (committed, staged, uncommitted and untracked; a deleted file
is left out) and runs, in order, stopping at the first failure with that step's exit code, each
step printed with its time and the run ending with the total:

1. **typecheck:** the whole `pnpm typecheck`, since a type change reaches beyond its file;
2. **lint:** `pnpm lint <changed files>`, the changed TypeScript files git tracks. An untracked file
   is named on one line and linted once `git add` tracks it;
3. **tests:** `vitest related --run` of the changed source files, or the whole `pnpm test` when the
   change touches a file every test depends on: `package.json`, `pnpm-lock.yaml`, a
   `tsconfig*.json`, `vitest.config.ts`, `eslint.config.ts` or a test setup file;
4. **fallow:** `pnpm fallow:audit` with `FALLOW_AUDIT_BASE` set to the merge-base, so a worktree's
   own code is audited (the commit hook audits the main checkout, not the worktree).

With no source file and no shared file changed, it runs the typecheck alone.

**Once, before a sub-pull request is marked ready** (and before every push to a ready pull request
into `main`), run the full `pnpm test` (the preflight, unchanged) and the full `pnpm lint`. A
sub-pull request runs no CI, so these are its only grade: `check:changed` is for iterating and
never stands in for them, since a break in a file the change did not touch slips past it.

**Mutation, when the change touches the delivery core** (PRD 1072, ADR-0059): after writing its
tests, and in a bug fix, run `pnpm mutation:changed --base origin/<feature branch>` (a few minutes per
file) and add or tighten a test for each survivor in the code you changed. A pull request never lowers a
floor in `mutation/floor.json`; the `mutation` workflow runs the whole core every night at 02:00 UTC and on
demand, outside the required checks, and shows a module below its floor in its job summary.

A commit hook runs only the checks that need no build: a hook that costs minutes buys the habit of
skipping it, and then it protects nothing. So a green commit is not a green branch. Never skip a
hook.

## Checks
<!-- slot: checks · optional -->
Beside the preflight, the `checks` workflow runs three more on a ready pull request into `main`,
each its own job, and each must be green before a hand-off:

- `pnpm typecheck`: `tsgo` (TypeScript's native preview, `@typescript/native-preview`) over the
  root project, then the arcade's own `typecheck` script (`fumadocs-mdx`, then `tsgo --noEmit`).
  `pnpm typecheck:tsc` runs the same pair with `tsc`: the fallback when `tsgo` reports something
  `tsc` does not, or misses something it does.
- `pnpm lint`: typescript-eslint's `strictTypeChecked` over every TypeScript file git tracks
  (`eslint.config.ts`, PRD 976), failing on any finding at all; `pnpm lint <path>…` lints only the
  files under those paths, the same way, and `pnpm lint --shard <i>/<n>` every n-th tracked file
  from the i-th (how CI splits it). An `eslint-disable` comment changes nothing, and
  `scripts/typescript-guard.test.ts` refuses one: fix the finding in code.
- `pnpm fallow:audit`: the audit of what the change touches.
