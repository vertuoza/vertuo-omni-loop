# Bug 1199: a roadmap's PRD links open Not found

## Triage

- **Domain:** galaxy app — the Roadmaps page's Gantt and PRD list, and the Loop page's timeline, ledger and parked rows
- **Risk:** medium — everyone opening a PRD from a roadmap or a loop lands on Not found; the PRDs list still reaches each dossier
- **Regression:** new bug — no evidence this ever worked: the links were born this way, the Loop page's in #1142 and the Gantt's in #1163

## Reproduction

- **File:** `apps/galaxy/src/roadmap/gantt.test.ts`
- **Red:** AssertionError: expected '/prd/1201' to be '/prd/at/vertuoza/vertuo-vibe-master-p…' // Object.is equality

## Fix

Both pages linked a PRD as `/prd/<number>`, but `/prd/<id>` only opens a dossier by its id, which neither page holds, so every link was Not found. They now link the short address `/prd/at/<owner>/<repo>/<n>?to=page`, which finds the dossier by the roadmap's (or the loop's) repository and the PRD's number among those the viewer may read; `?to=page` makes it land on the dossier's page instead of the Outbox tab the kit's outbox comment still lands on.

## Guard

The Gantt's test reads its link back with `readAt`, the short address route's own parser: a PRD link that route cannot open fails it (it fails on main's `/prd/<n>`).

## Mutation

mutation: no changed core file against origin/main (01e92277): nothing to mutate
