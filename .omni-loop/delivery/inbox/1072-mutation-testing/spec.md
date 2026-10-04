---
prd: 1072
title: Mutation testing
blocked-by: none
spec: file
---

# Mutation testing

**Date:** 2026-10-04 · **PRD:** #1072 · **Follows:** PRDs 556 (the bug-fix skill, which defined
`commands.mutation`), 1042 (a feedback loop in seconds) and 1066 (import boundaries) · **Touches:** new
dev dependencies, a `stryker.config.mjs`, `scripts/mutation-*`, `mutation/floor.json`,
`.github/workflows/mutation.yml`, `.omni-loop/config.yml`, a decision record and the `testing` and
`verification` forms · **Out of scope:** mutating anything outside the delivery core, mutation in PR
CI or in `check:changed`, any behaviour.

## Problem

The repository now enforces its types, its identifiers, its environment and its layers. Nothing yet
proves that the tests agents write catch bugs: a test can run every line and assert almost nothing.
Measured on `main` on 2026-10-04:

- `commands.mutation` exists since PRD 556, as "the command that runs mutation testing on the changed
  lines", and the bug-fix skill reads it after a fix; here it is unset, so all 11 bug records say
  `Mutation: not set here`, and two fixes mutated by hand.
- No mutation tool and no coverage provider is installed; no playbook form mentions mutation.
- The kit's library, `kit/lib`, is 139 source files, about 24,000 lines, and its own tests run in 9 s
  (2,238 tests); `bug/`, `constituents/` and `version/` have none. Its delivery core, the code whose bugs
  would merge or block the wrong work, is about 9,000 lines: `outbox/` (5,051), `policy/` (1,545),
  `inbox/` (1,083), `env/` (377), `board.ts`, `config.ts`, `layout.ts` and `ids.ts`.

## Solution

1. **Stryker,** with its vitest runner and TypeScript checker, in one `stryker.config.mjs`:
   - it mutates the delivery core (`kit/lib/outbox/`, `kit/lib/policy/`, `kit/lib/inbox/`, `kit/lib/env/`,
     `kit/lib/board.ts`, `kit/lib/config.ts`, `kit/lib/layout.ts`, `kit/lib/ids.ts`), tests excluded;
   - coverage is tracked per test, so a mutant runs only the tests that reach it, those under `kit/bin`
     and `scripts/` included;
   - the sandbox carries `kit/templates`, `kit/plugin` and the root `package.json`, which the kit finds
     through `import.meta.url`;
   - the checker runs `tsc` on the root project, so a mutant that does not compile is left out of the
     score, never counted as survived.

   If Stryker's vitest runner cannot run this repository's vitest, its command runner is used instead,
   and an outbox item says why.
2. **Two commands:**
   - `pnpm mutation` runs the whole core and writes Stryker's JSON and HTML reports;
   - `pnpm mutation:changed [--base <ref>]` runs only the core files changed against the base (default:
     the merge-base with `origin/main`); with none changed it says so and exits 0. Its last line is one
     summary, `mutation: <k> killed, <s> survived in <files>`, which the bug-fix skill records.
     `commands.mutation` in `.omni-loop/config.yml` is this command.
3. **The score:** `scripts/mutation-score.ts` reads the JSON report and scores each module (killed and
   timed out, over killed, timed out, survived and not covered; mutants that do not compile are left
   out). Against `mutation/floor.json`, one floor per module, it prints the table and, for every module
   below its floor, each surviving mutant with its file, line and mutation, and exits 1. A module in the
   report with no floor is reported, never passed silently.
4. **The floor only goes up:** the first floors are the first full run's scores, rounded down. A guard
   test refuses a change that lowers a floor or removes a module, against the default branch's copy;
   raising one is an ordinary edit.
5. **The nightly,** `.github/workflows/mutation.yml`, on a schedule (02:00 UTC) and on demand, outside
   the required checks: it runs `pnpm mutation` and the scorer, writes the score table to the job
   summary, and uploads the HTML report.
6. **Agents are told:** a decision record, and the `testing` and `verification` forms: when to run
   `pnpm mutation:changed` (after writing tests for core code, and in a bug fix), and that a floor never
   goes down.

Mutation never runs in `check:changed`, in the preflight or in pull request CI: the fast loop stays as
PRD 1042 made it.

## Decisions

Taken in the brainstorm on 2026-10-04 with the person who asked for this PRD.

- **The delivery core first,** over all of `kit/lib` (about 24,000 lines of mutants against tests that
  spawn git: hours per run) and over one module. The scope widens in later PRDs as the floors hold.
- **A floor per module,** over one global score (a weak module hides behind a strong one) and over a
  report with no floor (nothing holds the line).
- **`commands.mutation` keeps PRD 556's meaning:** mutation on the changed lines, read by the bug-fix
  skill; this PRD only sets it here.
- **Prove first:** the first slice proves Stryker runs on this stack (native TypeScript, vitest 4) before
  anything depends on it.
- **No proof video:** nothing visible changes.
- **The voice.** B-E DEv objected that a nightly red at 2 am with nobody assigned is noise within a week,
  and wanted a failure to land somewhere a person or an agent picks up. Settled `none`: the person
  approved the design as shown, where a red night shows in Actions and its job summary.

## User stories

1. As an agent writing tests for the outbox, I run `pnpm mutation:changed` and see which changes to my
   code my tests let through, with the file and line.
2. As an agent fixing a bug, the bug-fix skill runs the same command and records its line in `bug.md`,
   instead of `Mutation: not set here`.
3. As the person running the repository, the nightly tells me, per module, whether the tests still catch
   what they caught yesterday.
4. As a reviewer, a pull request that lowers a floor fails.

## Scope

In:

- Stryker's dev dependencies and `stryker.config.mjs`, for the delivery core.
- `pnpm mutation`, `pnpm mutation:changed`, `scripts/mutation-score.ts`, `mutation/floor.json`, the
  no-lowering guard, and their tests.
- `commands.mutation` in `.omni-loop/config.yml`.
- `.github/workflows/mutation.yml`.
- A decision record and the `testing` and `verification` forms.

Out:

- Mutating anything outside the delivery core.
- Mutation in `check:changed`, the preflight or pull request CI.
- Writing tests to raise a score: the floors start where the code is.
- An issue or notification on a red night.

## Test seams

- **The scorer, on fixture reports** (never by running Stryker): killed, timed-out, survived, not-covered
  and non-compiling mutants give the right score per module; a module below its floor exits 1 and lists
  its survivors with file and line; all at or above exits 0; a module with no floor is reported.
- **The guard:** lowering a floor or removing a module fails against the default branch's copy; raising
  one passes.
- **`mutation:changed`'s plan:** no changed core file exits 0 without running Stryker; with changes, the
  files it would mutate are exactly the changed core files. The plan is tested, not the run.
- **The real runs:** the first slice's sub-PR records a full-core run (time, mutant counts, scores), and
  the floor file comes from it; the nightly workflow is run once on demand before the feature PR is
  ready.
- **Nothing slows down:** the full suite, both typechecks, lint, the fallow audit and the source guards
  pass; `check:changed` runs what it ran before.

## Risks

Merging adds dev dependencies and a scheduled workflow that uses CI minutes each night (bounded by its
timeout). Nothing is published to the kit's bundle, nothing reaches the apps, and no migration runs. A
Stryker version that stops supporting this stack would turn the nightly red, never a pull request.

**Rollback:** revert the feature PR; the workflow can also be disabled alone.

## Acceptance criteria

- `pnpm mutation` mutates exactly the delivery core and writes a JSON and an HTML report.
- `pnpm mutation:changed` mutates only the changed core files, exits 0 when there are none, and ends with
  one summary line; `commands.mutation` is set to it.
- `scripts/mutation-score.ts` exits 1 when a module is below its floor, naming every survivor's file and
  line, and 0 otherwise; its fixture tests pass.
- `mutation/floor.json` holds a floor per core module from the first full run, and a test refuses lowering
  any of them.
- `.github/workflows/mutation.yml` runs nightly and on demand, writes the score table to its summary and
  uploads the report; one on-demand run passed on the feature branch.
- `omni kb show testing` and `omni kb show verification` say when to run `pnpm mutation:changed`.
- `pnpm typecheck`, `pnpm typecheck:tsc`, `pnpm test`, `pnpm lint` (0 findings) and the fallow audit pass.
