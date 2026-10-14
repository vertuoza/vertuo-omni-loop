# Bug 1948: Kevin's points miss his PRs on backend-php, vertuo-soft and vertuo-build

## Triage

- **Domain:** game layer — the GitHub snapshot `game:project` reads (`game/sources/github.ts`)
- **Risk:** high — every player who ships a PRD in several landings loses the zone points of each slice outside the first landing (10 of Kevin's 12 merged sub-PRs on VertuoBuild PRDs 57 and 62); no workaround, though the ledger replays them once fixed (Jev, 0.70)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `game/sources/github.test.ts`
- **Red:** `buildSnapshot > secures each slice from the sub-PR into its own landing's feature branch (#1948)`: expected `[['s1', 501, 'alice'], ['s2', null, null]]` to equal `[['s1', 501, 'alice'], ['s2', 511, 'pm']]`

## Fix

A PRD in landings has one `omni:feature` PR per landing, each saying `Closes #<n>` (or `Part of <home>#<n>` in a target), and each landing's sub-PRs merge into its own branch. The snapshot kept only the lowest-numbered feature PR and listed sub-PRs into that branch alone, so landing 2's slices were never secured. `readZones` now lists the `omni:sub` PRs into every landing's feature branch, for the home and for each `Part of` region; the region's feature PR, its terraform and its merge pay are unchanged.

## Guard

The two reproductions are the guard: unit tests of `buildSnapshot` with a PRD in two landings, one in its home and one in a `Part of` target, red on the default branch's code and green on the fix.

## Mutation

mutation: no changed core file against origin/main (47519e58): nothing to mutate
