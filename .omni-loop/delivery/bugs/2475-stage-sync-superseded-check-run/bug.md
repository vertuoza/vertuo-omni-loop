# Bug 2475: the stage sync reads a pull request's checks red when a cancelled run was superseded by a successful run on the same head

## Triage

- **Domain:** the Omni page's waits · the stage sync's GitHub reader (`apps/galaxy/src/stages/sync/github.ts`, `checksOf`), read by `waitingFor` and `lawWaits` in `apps/galaxy/src/stages/sync/waits.ts` (PRD 2377)
- **Risk:** high — whoever merges never sees the `merge` wait of an approved, green pull request whose head still lists a cancelled run a later run superseded: the waits read a red check and treat it as waiting on its author; GitHub's own page shows it green (Jev, 0.86)
- **Regression:** new bug — no evidence this ever worked: `checksOf` has read every listed run since it was added in #2381 (PRD 2377)

## Reproduction

- **File:** `apps/galaxy/src/stages/sync/github.test.ts`
- **Level:** unit, the stage sync's reader against a stubbed GitHub
- **Red:** AssertionError: expected { number: 9, …(15) } to match object { checksRed: false }

## Fix

GitHub's check-runs list keeps the latest run of a check per check suite only, and each workflow run is
a suite of its own, so a run a later one superseded on the same head (`quick` cancelled, then `quick`
success) stays listed beside it, and `checksOf` read the pull request's checks red. It now keeps the
newest run of each check, the one with the greatest id, before reading `checksRed` and the laws the
outbox check holds, so a superseded red outbox run holds no law either; a check whose only run was
cancelled, or whose newest run failed, still reads red.

## Guard

Three unit tests of the stage sync's reader: a check re-run green after a cancelled run reads green; an
outbox run a later green run superseded holds no law; a check whose only run was cancelled, and an
outbox check whose newest run failed after a green one, still read red and hold their law. The first
two fail on `main`'s code; with the third, they kill the mutants that keep the first listed, the last
listed or the smallest-id run.

## Mutation

mutation: no changed core file against origin/main (ddfa252a): nothing to mutate

`apps/galaxy/` is outside the delivery core Stryker mutates; four mutants of the fixed lines (no
dedup, keep the first listed, the last listed or the smallest-id run) were run by hand, and the tests
killed each.
