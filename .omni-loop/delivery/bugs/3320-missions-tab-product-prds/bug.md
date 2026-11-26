# Bug 3320: the Missions tab fails to load when a mission's scope names product PRD ids

## Triage

- **Domain:** missions (the AI Fleet's Missions tab and the commander rail's mission read)
- **Risk:** high — every member of a fleet that holds one mission scoped by product PRD ids sees no mission at all and cannot press Start on a new one; no workaround short of editing the row in the database (Jev, 0.67)
- **Regression:** yes — #3142 (omni-loop-21) let a mission's scope name product PRD ids, while the tab's reader kept `scope.prds` numbers only

## Reproduction

- **File:** `apps/galaxy/src/missions/page/missions-tab.test.ts`
- **Level:** unit
- **Red:** Error: missions/page/missions-tab.repository: missions: the answer does not parse: [1].scope.prds[1] invalid_type (expected number)

## Fix

The Missions tab's reader and the commander rail's parsed a mission's `scope.prds` as repository PRD numbers only, so one mission scoped by product PRD ids made the whole read throw and the tab showed "Couldn't load this" for every mission. Both now read a scope PRD as a number or a product PRD id, and the tab's reader parses each mission row on its own, logging and leaving out one it cannot read.

## Guard

The three tests of the reproduction: a scope mixing `2803` and `demo-loop-28` read by the tab and by the rail, and a malformed mission row left out while every other mission shows.

## Mutation

mutation: no changed core file against origin/main (3d69d57f): nothing to mutate

## Still open

- The Omni app's ready check reads a live mission's scope.prds as numbers only, so it fails for a repository that holds a mission scoped by product PRD ids.
