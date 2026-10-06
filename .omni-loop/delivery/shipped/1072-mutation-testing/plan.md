# Plan: Mutation testing

PRD #1072, specified in `spec.md` beside this plan. Built on the feature branch `feat/mutation-testing`
into `main` (the feature PR says `Closes #1072`), from sub-PRs on `feat/mutation-testing--<slice>` into the
feature branch (each says `Part of #1072`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Stryker is installed and configured for the delivery core, and `pnpm mutation` runs: proved first on `kit/lib/ids.ts`, then on the whole core, with the run's time, mutant counts and per-module scores in the sub-PR | `stryker.config` `package.json` `pnpm-lock.yaml` `.gitignore` | — | 1 |
| s2 | `scripts/mutation-score.ts` scores each module against `mutation/floor.json` (the first floors from s1's run), a guard refuses lowering a floor, `pnpm mutation:changed` mutates only the changed core files, and `commands.mutation` is set to it | `scripts/mutation` `mutation/` `package.json` `.omni-loop/config.yml` | s1 | 2 |
| s3 | `.github/workflows/mutation.yml` runs the core nightly and on demand, with the score table in its summary and the HTML report uploaded; a decision record and the `testing` and `verification` forms tell agents when to run `pnpm mutation:changed` | `.github/workflows/mutation` `.omni-loop/knowledge/` | s2 | 3 |

**Shared ground.** `package.json` is s1's (the dependencies and `mutation`) and s2's
(`mutation:changed`): waves 1 and 2. Each slice needs the one before: s2 reads s1's report format and
first scores, s3 calls s2's scorer.

## Per slice: done when

**s1**

- `@stryker-mutator/core`, its vitest runner and its TypeScript checker are dev dependencies (pnpm 9
  lockfile); `stryker.config.mjs` mutates exactly the spec's delivery core, tests excluded, with
  per-test coverage, the `tsc` checker on the root project, and a sandbox carrying `kit/templates`,
  `kit/plugin` and the root `package.json`.
- `pnpm mutation` runs and writes a JSON and an HTML report under a git-ignored reports folder.
- Proved on `kit/lib/ids.ts` alone first; then the whole core runs locally, and the sub-PR records its
  time, mutant counts by status, and the score per module (`outbox`, `policy`, `inbox`, `env`, `board`,
  `config`, `layout`, `ids`).
- If the vitest runner cannot run this repository's vitest, the command runner is used, and an outbox
  item says why and what it costs.
- The full suite, both typechecks, lint and the fallow audit pass; `check:changed` is unchanged.

**s2**

- `scripts/mutation-score.ts` reads the JSON report, scores each module (killed and timed out over
  killed, timed out, survived and not covered; non-compiling mutants left out), prints the table, lists
  each survivor of a module below its floor with file, line and mutation, exits 1 then and 0 otherwise,
  and reports a module with no floor.
- `mutation/floor.json` holds s1's scores, rounded down, one per module.
- A guard test fails when a floor is lower than, or a module missing from, the default branch's copy;
  raising passes.
- `pnpm mutation:changed [--base <ref>]` mutates only the changed core files (default base: the
  merge-base with `origin/main`), exits 0 saying so when there are none, and ends with
  `mutation: <k> killed, <s> survived in <files>`; `commands.mutation` in `.omni-loop/config.yml` is it.
- Tests: the scorer on fixture reports, the guard, and `mutation:changed`'s plan, none running Stryker.

**s3**

- `.github/workflows/mutation.yml`: `schedule` (02:00 UTC) and `workflow_dispatch`, pnpm 9 and Node 22
  as the other workflows, a timeout, `pnpm mutation` then the scorer, the table in `$GITHUB_STEP_SUMMARY`,
  the HTML report as an artifact; not a required check.
- One on-demand run on the feature branch passes; the sub-PR links it and gives its time.
- A decision record under `.omni-loop/knowledge/adr/`; `omni kb show testing` and
  `omni kb show verification` say to run `pnpm mutation:changed` after writing tests for core code and in a
  bug fix, and that a floor never goes down.
- `omni check all` passes.
