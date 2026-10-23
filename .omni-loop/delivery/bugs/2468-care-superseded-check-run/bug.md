# Bug 2468: omni care state reads a PR's checks red when a cancelled run was superseded by a successful run on the same head

## Triage

- **Domain:** the loop's facts · the Omni page's GitHub reads (`apps/galaxy/src/loop/github.ts`), which the kit's care state (`kit/lib/care/state.ts`) grades
- **Risk:** medium — agents caring for a pull request (`/omni:pr-care`, `/omni:wave`, `/omni:drive`) read a green PR as red whenever a workflow run on its head was superseded, so a merge is held or an agent chases a failure that is not there; the workaround is to read the PR's checks on GitHub (Jev, 0.87)
- **Regression:** yes — #1666 (d03a4d165, PRD 1665): before it, `omni care state` read GitHub's own `statusCheckRollup.state`, which reads `SUCCESS` for #2456's head; since it, the state is recomputed from every check run the Omni page lists

## Reproduction

- **File:** `apps/galaxy/src/loop/github.test.ts`
- **Level:** unit, the loop's GitHub host against a stubbed GitHub, its answer graded by the kit's `careState`
- **Red:** AssertionError: expected { state: 'red', …(3) } to match object { state: 'green', failed: [] }

## Fix

GitHub's check-runs list keeps the latest run of a check per check suite only, so on #2456's head the
`quick` run a later workflow run superseded (cancelled) stayed listed beside the run that replaced it
(success), and the care state, grading every entry, read red with `quick` failed. The Omni page's
`checksOf` now keeps the newest run of each check, the one with the greatest id, so the facts carry
one entry per check as their contract says; a check whose only run was cancelled still reads failed.

## Guard

A unit test of the loop's GitHub host: runs of one check listed out of order (an older failure and a
cancellation around a newer success, an older success before a newer queued run) answer the newest
of each, and a check run once and cancelled answers failure. It fails on `main`'s code and on the
mutants that keep the first, the last or the smallest-id run.

## Mutation

mutation: no changed core file against origin/main (ddfa252a): nothing to mutate

`apps/galaxy/` is outside the delivery core Stryker mutates; three mutants of the fixed line (keep
the first, the last or the smallest-id run) were run by hand, and the tests killed each.
