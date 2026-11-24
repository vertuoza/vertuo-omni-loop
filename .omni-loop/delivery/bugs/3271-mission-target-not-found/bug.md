# Bug 3271: a goal-only mission stops waking once its PM's plans are recorded

## Triage

- **Domain:** missions: the mission branch per target (`apps/omni-app/src/missions/branch.ts`)
- **Risk:** medium — any mission holding a product PRD whose plan names a repository GitHub cannot find fails every try silently and stops after 5, for all its PRDs; no workaround but editing each plan's Repositories table by hand
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/missions/branch.test.ts`
- **Level:** unit
- **Red:** `AssertionError: promise rejected "Error: Not Found - https://docs.github.co… { status: … }" instead of resolving`

## Fix

`planTargets` turned any cell of a plan's Repositories table into `owner/<cell>`, so `omni-loop (this repository)` became a repository GitHub could not find, and `prepare` threw on its 404, which failed the mission's whole job on every try. Now a cell that names no repository is not read, and a 404 on a target makes the mission wait, naming the repository, as it already does for a repository without rebase merges.

## Guard

none — the reproduction is the cheap check that would have caught it, a unit test of a target GitHub does not find

## Mutation

mutation: no changed core file against origin/main (7bb0a48e): nothing to mutate

## Still open

- A mission's PM plan job prints its omni plan record on 3 of 7 runs only, because its line carries no --mission; the 4 others are escalated as no record of the plan approval.
- The PM's plans write their Repositories table in three shapes (owner/name, a sentence, or no table), which the build reads as its targets.
