# Bug 2963: a new PRD stays on Syncing… because the stages sync never reaches its repository

## Triage

- **Domain:** galaxy: the stages sync (`apps/galaxy/src/stages/sync/sync.ts`, `apps/galaxy/src/stages/store.ts`)
- **Risk:** high — every member of a workspace sees a new PRD with no stage for hours, and the boards and counts that read stages miss it; no workaround but waiting. (Jev, 0.99)
- **Regression:** yes — #2551 (8c192c1c0) made the sync start no repository past 120 s, oldest synced first, keyed on the newest `prd` stage row, which moves only when a PRD issue changed.

## Reproduction

- **File:** `apps/galaxy/src/stages/sync/sync.slow.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ 'acme/r1', 'acme/r2', …(2) ] to deeply equal [ 'acme/r5', 'acme/r6', …(2) ]` and `AssertionError: expected [ 'f1', 'c1' ] to deeply equal []`

## Fix

The sync took "when a repository was last read" from its newest `prd` stage row, which it rewrites only when a PRD issue changed, so a quiet repository looked never read: it went first every run, re-read an ever older window, and a repository holding a new PRD waited behind it run after run. A new table, `repository_syncs`, backfilled from that same date, now records each read whatever it held, and the sync orders and reads from it. The fix and concept facts, which took up to 115 s after the repositories, are no longer started once the run has taken 180 s, so a run ends before the route's 300 s.

## Guard

The two reproduction tests in `sync.slow.test.ts`: two runs over quiet repositories must read next the ones that waited, and a run past 180 s must start no fix or concept facts.

## Mutation

mutation: no changed core file against origin/main (7bfc0391): nothing to mutate

## Still open

- The Waiting board's "last synced" still reads the newest `prd` stage row, so it shows a quiet repository as synced long ago.
