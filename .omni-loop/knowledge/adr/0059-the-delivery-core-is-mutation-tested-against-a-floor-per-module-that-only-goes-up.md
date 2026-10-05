# ADR-0059 — The delivery core is mutation tested against a floor per module that only goes up

**Status:** accepted · **Date:** 2026-10-05 · **PRD:** #1072

## Context

The repository enforces its types, its identifiers, its environment and its layers, but nothing proved
that the tests agents write catch bugs: a test can run every line and assert almost nothing.
`commands.mutation` existed since PRD 556 for the bug-fix skill, unset here, so every bug record said
`Mutation: not set here`. The kit's delivery core, the code whose bugs would merge or block the wrong
work, is about 9,000 lines; mutating the whole of `kit/lib` would take hours per run.

## Decision

1. **Stryker** (its vitest runner and TypeScript checker, `stryker.config.ts`) mutates the delivery core:
   `kit/lib/outbox/`, `kit/lib/policy/`, `kit/lib/inbox/`, `kit/lib/env/`, `kit/lib/board.ts`,
   `kit/lib/config.ts`, `kit/lib/layout.ts` and `kit/lib/ids.ts`, tests excluded. A mutant runs the kit
   library's own tests that reach it (`stryker.config.vitest.ts`, settled item s1-02), with a 5 s
   timeout beyond their time (s1-01). A mutant that does not compile is left out of the score.
2. **The score of a module** is killed and timed out over killed, timed out, survived and not covered.
   `pnpm mutation:score` (`scripts/mutation-score.ts`) judges each module against its floor in
   `mutation/floor.json`, lists the survivors of a module below it with file, line and mutation, and exits
   1 then.
3. **A floor only goes up.** The first floors are the first full run's scores, rounded down.
   `scripts/mutation-floor.test.ts` refuses a floor lowered or a module removed against `origin/main`'s
   copy, and skips where `origin/main` is not fetched (s2-02).
4. **Agents run `pnpm mutation:changed`** after writing tests for core code and in a bug fix: it mutates
   only the changed core files and ends with `mutation: <k> killed, <s> survived in <files>` (s2-01).
   `commands.mutation` is this command, as PRD 556 defined it.
5. **The nightly,** `.github/workflows/mutation.yml`, runs the whole core at 02:00 UTC and on demand,
   one job per module side by side (outbox split in three), then one job that merges their reports,
   scores them, writes the table to the job summary and uploads the report. It is not a required check.
6. **Mutation never runs** in `check:changed`, the preflight or pull request CI: the fast loop stays as
   PRD 1042 made it.

## Consequences

- A test that runs code without asserting what it does shows as a survivor, with its line, in the
  agent's own run.
- A pull request that lowers a floor fails `pnpm test`; raising a floor after adding tests is an
  ordinary edit.
- A red night shows in Actions and its job summary, and nowhere else: nobody is assigned (the spec's
  settled voice). The nightly uses CI minutes each night, bounded by each job's timeout.
- A mutant only a command test under `kit/bin` or `scripts/` would catch counts as survived.
- Widening the scope beyond the delivery core is a later PRD: the mutate globs, the workflow's shards
  and a floor per new module.
