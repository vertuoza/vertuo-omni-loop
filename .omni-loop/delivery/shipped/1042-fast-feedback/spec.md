---
prd: 1042
title: A feedback loop in seconds
blocked-by: none
spec: file
---

# A feedback loop in seconds

**Date:** 2026-10-03 · **PRD:** #1042 · **Follows:** PRDs 976 (linting at zero), 598 (the settle gate)
and 1030 (no escape hatches) · **Touches:** a new `scripts/check-changed.ts`, `scripts/lint-repository.ts`,
`package.json`, `.github/workflows/checks.yml`, `.omni-loop/knowledge/playbook/verification.md` and
`ci.md`, and `kit/bin/commands/care.ts` only if `tsgo` needs it · **Out of scope:** the settle gate's
wait, the `supabase` workflow, any app behaviour.

## Problem

AI agents build this repository in waves of slices, and each agent checks its work over and over. Every
check it runs today covers the whole repository. Measured on `main` on 2026-10-03:

| Check | Local (10-core Mac) | CI (`ubuntu-latest`, PR #1031) |
|---|---|---|
| `pnpm typecheck` (root + arcade) | 6 s | 53 s |
| `pnpm lint` (type-aware, 1,709 files) | 43 s, up to ~5.6 GB RAM | 181 s |
| `pnpm test` (674 files, 10,009 tests) | 62 s | 174 s |
| `pnpm lint <one file>` / `<one folder>` (exists, unused by agents) | 3 s / 6–10 s | — |
| `vitest related <one file>` | 3 s for a leaf module, 54 s for a core one | — |
| `tsgo -p .` (TypeScript 7 native preview, root) | 1 s, 1 error | — |

So typecheck is not the bottleneck. The slow loop is that an agent runs the full lint and the full
suite after every change, because nothing offers it a scoped check, and four agents doing so at once are
why a wave runs at most four agents on a 32 GB machine. In CI, after the settle gate's deliberate 180 s,
`test` and `lint` each take about 3 minutes on a 2-core runner.

The audit gap PRD 1030 hit belongs here too: the commit hook audits the main checkout, not the worktree
a slice is built in, so a slice's own code reached CI unaudited.

## Solution

1. **`pnpm check:changed [--base <ref>]`** (`scripts/check-changed.ts`). The base defaults to the
   merge-base of `HEAD` with `origin/main`. It takes the changed and untracked TypeScript files against
   the base, then runs, in order, stopping at the first failure, and prints each step with its time:
   1. **typecheck:** the whole `pnpm typecheck`, since a type change reaches beyond the files it is in;
   2. **lint:** `pnpm lint <changed files>`, through `scripts/lint-repository.ts`'s existing prefix mode;
   3. **tests:** `vitest related <changed files> --run`, or the whole suite when the change touches a
      file every test depends on: `package.json`, `pnpm-lock.yaml`, a `tsconfig*.json`,
      `vitest.config.ts`, `eslint.config.ts` or a test setup file;
   4. **fallow:** `pnpm fallow:audit` with `FALLOW_AUDIT_BASE` set to the base, so a worktree's own
      code is audited.
   With no changed file it says so and runs the typecheck alone.
2. **Agents are told.** The playbook's verification form says: while iterating, `pnpm check:changed`;
   once, before a sub-PR is marked ready, the full preflight (`commands.preflight`, unchanged) and the
   full lint. The `ci` form records the sharded jobs.
3. **Faster CI** (`.github/workflows/checks.yml`):
   - **test** runs as 3 shards (`vitest run --shard=<i>/3`) in a matrix, and a job named `test` passes
     only when all three passed, so the check name stays `test`;
   - **lint** runs as 2 shards: `scripts/lint-repository.ts` takes `--shard <i>/<n>` and lints every
     n-th tracked file, and a job named `lint` gathers them the same way;
   - **typecheck** runs `tsgo` when item 4 lands, `tsc` otherwise;
   - **settle** keeps its 180 s wait (PRD 598), and every sharded job stays behind it.
4. **`tsgo`, only when it agrees with `tsc`.** `@typescript/native-preview` is added, and
   `pnpm typecheck` runs `tsgo` for the root project and the arcade, only if `tsgo` reports exactly what
   `tsc` reports (no error) on both. Its one error today (`kit/bin/commands/care.ts:104`, TS2589, a type
   instantiation too deep) is fixed in code with no cast. `pnpm typecheck:tsc` keeps the `tsc` run as the
   fallback. If `tsgo` cannot agree, the `tsc` script stays and an outbox item says why.

## Decisions

Taken in the brainstorm on 2026-10-03 with the person who asked for this PRD.

- **Reshaped from the brief.** Asked for as "the native compiler, project references and changed-only
  lint", measured first: typecheck takes 6 s, so the native compiler saves about 5 s, and project
  references are dropped. The scope became the agent's loop, CI and `tsgo` together ("All of it").
- **The settle gate keeps its 180 s** (PRD 598's cost trade-off); only the checks behind it get faster.
- **The full suite stays the gate.** `check:changed` is for iterating; `commands.preflight` stays
  `pnpm test`, and CI always runs everything.
- **No proof video:** nothing visible changes.
- **The voice.** F-E Developer objected that a check scoped to the change is how a break in a file
  nobody touched slips through, and wanted the full suite to stay the gate. Settled `none`: the person
  approved the design as shown, which already keeps the full preflight before ready and the full CI.

## User stories

1. As an agent changing three files, I check my work in about 20 s instead of about 2 minutes, and the
   output tells me which step failed and how long each took.
2. As an agent in a worktree, the fallow audit grades my own changes, not the main checkout's.
3. As the person running a wave, more agents fit at once, because each one's loop needs far less memory.
4. As a reviewer, a pushed PR reports `test` and `lint` in about half the time.

## Scope

In:

- `scripts/check-changed.ts`, its `pnpm check:changed` script, and its tests.
- `--shard <i>/<n>` in `scripts/lint-repository.ts`, and its tests.
- The `checks` workflow's sharded `test` and `lint`, with their gathering jobs.
- `tsgo` for `pnpm typecheck` and the `care.ts` fix, under item 4's condition.
- The playbook's `verification` and `ci` forms.

Out:

- The settle gate's wait, and the `supabase`, `game` and release workflows.
- Project references and any `tsconfig` restructuring.
- Any change to `commands.preflight` or to what the do-work gate runs.
- Any app or kit behaviour.

## Test seams

- **`check:changed`:** on a fixture repository (`kit/test/fixture.ts`'s `makeRepo()`), its plan, the
  steps it would run with their arguments, for a change in one source file, in a test file, in
  `package.json` (the whole suite), and in nothing (typecheck alone); and that it stops at the first
  failing step. The plan is what is tested; the test never runs lint or vitest itself.
- **Lint shards:** the union of the `n` shards' files is exactly the unsharded file list, with no file
  twice, for `n` from 1 to 4.
- **Test shards:** the workflow's matrix and `--shard` arguments cover `1/3` to `3/3`; a test reads
  `checks.yml` and checks the `test` and `lint` gathering jobs need every shard.
- **`tsgo`:** `pnpm typecheck` passes with it, and `pnpm typecheck:tsc` passes too, on the same tree.
- **Timings:** measured, not tested: the feature PR's **Verified** gives CI's `test`, `lint` and
  `typecheck` times after settle, before and after, and `check:changed`'s time on a typical slice.

## Risks

A merge to `main` changes what CI runs on every pull request, and the scripts agents run. A shard that
silently skipped files would let a failure through; the union test above guards it. `tsgo` is a preview
compiler: if it reports less than `tsc` one day, typecheck would pass what `tsc` refuses; the
`typecheck:tsc` script and the agreement condition guard that, and switching back is one line. Nothing
is published to the kit's bundle, and no migration runs.

**Rollback:** revert the feature PR. The workflow, `tsgo` and `check:changed` are each separable, so a
single part can also be reverted alone.

## Acceptance criteria

- `pnpm check:changed` on a change to one source file runs the typecheck, lints that file, runs its
  related tests and the fallow audit against the base, prints each step's time, and exits non-zero at
  the first failing step.
- A change to `package.json`, the lockfile, a `tsconfig*.json`, `vitest.config.ts`, `eslint.config.ts`
  or a test setup file makes `check:changed` run the whole test suite.
- The lint shards' union equals the whole file list, with no duplicate.
- On the feature PR, the `checks` workflow reports `test` and `lint` as single checks gathered from
  their shards, and its **Verified** gives before-and-after CI times.
- `pnpm typecheck` runs `tsgo` and passes, and `pnpm typecheck:tsc` passes; or the `tsc` script stays
  and an outbox item explains why `tsgo` did not land.
- The playbook's `verification` form tells agents to use `pnpm check:changed` while iterating and the
  full preflight and lint once before ready; `omni kb show verification` prints it.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` (0 findings) and the fallow audit pass.
