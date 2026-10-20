---
form: verification
form-version: 1
state: filled
points-to: null
evidence:
  - package.json@9870eaf
  - vitest.config.ts@731c58f
  - kit/test/dist.test.ts@0f196ea
  - apps/galaxy/package.json@c9781fd
  - .github/workflows/game.yml@4bf6bd0
  - .github/workflows/supabase.yml@a4bc540
  - scripts/check-changed.ts@1d62baa
  - scripts/check-changed-steps.ts@2d48772
  - scripts/lint.ts@efc3f1b
  - scripts/lint-repository.ts@b154f4c
  - .github/workflows/checks.yml@af9027a
  - scripts/check-changed-hooks.ts@c844953
  - .github/workflows/quick.yml@2fe8e9e
invaded: 2026-10-20
---

# Verification

Use this page when handing off changes: what must be green before a pull request, and before a push.

## The preflight
<!-- slot: preflight · required · by: invade · verified: 2026-10-20 -->
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
   own code is audited.

With no source file and no shared file changed, it runs the typecheck alone.

**Once, before a sub-pull request is marked ready** (and before every push to a ready pull request
into `main`), run the full `pnpm test` (the preflight, unchanged) and the full `pnpm lint`. The
`quick` workflow grades a draft and a sub-pull request with `check:changed`, which never stands in
for them: a break in a file the change did not touch slips past it.

**Mutation, when the change touches the delivery core** (PRD 1072, ADR-0059): after writing its
tests, and in a bug fix, run `pnpm mutation:changed --base origin/<feature branch>` (a few minutes per
file) and add or tighten a test for each survivor in the code you changed. A pull request never lowers a
floor in `mutation/floor.json`; the `mutation` workflow runs the whole core every night at 02:00 UTC and on
demand, outside the required checks, and shows a module below its floor in its job summary.

`pnpm install` turns on two git hooks (`.githooks/`) for every agent and person: **pre-commit**
runs `fallow audit` of the work tree committed (~1 s), **pre-push** `check:changed`'s typecheck and
lint from the upstream, else `origin/main` (~10 s). Both fail closed. Tests are left to CI: a hook
that costs minutes buys the habit of skipping it. A green commit is not a green branch. Never skip
a hook.

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
