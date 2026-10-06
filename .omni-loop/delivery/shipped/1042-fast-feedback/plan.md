# Plan: A feedback loop in seconds

PRD #1042, specified in `spec.md` beside this plan. Built on the feature branch `feat/fast-feedback` into
`main` (the feature PR says `Closes #1042`), from sub-PRs on `feat/fast-feedback--<slice>` into the
feature branch (each says `Part of #1042`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `pnpm check:changed [--base <ref>]` typechecks, lints the changed files, runs their related tests (or the whole suite when a shared file changed) and the fallow audit against the base, stopping at the first failure and timing each step | `scripts/check-changed` `package.json` | — | 1 |
| s2 | CI shards `test` (3) and `lint` (2) behind settle, each gathered into one check of the same name, with `--shard <i>/<n>` in the lint script | `scripts/lint-repository` `scripts/checks-workflow` `.github/workflows/checks.yml` | — | 1 |
| s3 | `pnpm typecheck` runs `tsgo` for the root project and the arcade when it agrees exactly with `tsc`, `care.ts`'s TS2589 fixed with no cast, and `pnpm typecheck:tsc` kept | `package.json` `pnpm-lock.yaml` `apps/galaxy/package.json` `kit/bin/commands/care` `kit/dist/` `.omni-loop/bin/` | s1 | 2 |
| s4 | The playbook's `verification` and `ci` forms tell agents the loop: `pnpm check:changed` while iterating, the full preflight and lint once before ready, and how CI shards | `.omni-loop/knowledge/playbook/verification.md` `.omni-loop/knowledge/playbook/ci.md` | s1, s2, s3 | 3 |

**Shared ground.** `package.json` is s1's (it adds `check:changed`) and s3's (it changes `typecheck` and
adds `typecheck:tsc`): s1 is wave 1, s3 wave 2. No other prefix is shared. s4 documents what s1 to s3
built, so it comes last.

## Per slice: done when

**s1**

- `pnpm check:changed` exists, and `scripts/check-changed.test.ts` proves its plan on a fixture repository
  (`makeRepo()`): one changed source file gives typecheck, lint of that file, `vitest related` of it and
  the fallow audit with `FALLOW_AUDIT_BASE` set to the base; a change to `package.json`,
  `pnpm-lock.yaml`, a `tsconfig*.json`, `vitest.config.ts`, `eslint.config.ts` or a test setup file
  gives the whole suite; no change gives typecheck alone; and a failing step stops the run with its
  exit code. The test never runs lint or vitest itself.
- Each step prints its name and time; the run ends with the total.
- Run on a real three-file change in this repository, it takes under 30 s on the builder's machine (the
  time goes in the sub-PR).

**s2**

- `scripts/lint-repository.ts` takes `--shard <i>/<n>` and lints every n-th tracked file; a test proves
  the union of the shards equals the unsharded list with no duplicate, for n from 1 to 4.
- `.github/workflows/checks.yml` runs `test` as a 3-shard matrix (`vitest run --shard=<i>/3`) and `lint`
  as 2 shards, each behind `settle`, with a gathering job named `test` and one named `lint` that pass
  only when every shard passed (and skip when settle says stale).
- `scripts/checks-workflow.test.ts` reads the workflow and proves the gathering jobs need every shard
  and the shard arguments cover `1/n` to `n/n`.

**s3**

- `@typescript/native-preview` is a dev dependency; `pnpm typecheck` runs `tsgo` for the root project
  and the arcade and passes; `pnpm typecheck:tsc` runs today's `tsc` pair and passes on the same tree.
- `kit/bin/commands/care.ts`'s TS2589 under `tsgo` is fixed with no cast, its tests unchanged, and the
  kit bundle rebuilt.
- If `tsgo` cannot agree with `tsc` on both projects, `typecheck` stays `tsc` and an outbox item says
  what `tsgo` reported.

**s4**

- `omni kb show verification` prints the loop: `pnpm check:changed` while iterating, the full preflight
  and `pnpm lint` once before a sub-PR is ready.
- `omni kb show ci` names the sharded `test` and `lint` jobs and what `typecheck` runs.
- `omni check all` passes.
