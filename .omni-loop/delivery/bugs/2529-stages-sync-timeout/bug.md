# Bug 2529: the stages sync times out, so the stages pages go stale

## Triage

- **Domain:** stages sync (`apps/galaxy/src/stages/sync`)
- **Risk:** medium — every workspace sees stale PRD stages, outbox counts, fix facts and milestones while runs are cut off; nothing is lost, and a run that finishes catches up
- **Regression:** yes — green runs on Oct 24–26 (`stages-sync` ok, 245–300 s, 22 repositories) followed by runs cut off at 300 s from Oct 26

## Reproduction

- **File:** `apps/galaxy/src/stages/sync/sync.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected 1 to be 4 // Object.is equality`

## Fix

The sync read every repository of a workspace one after another; with 22 repositories at about 13 s each,
a run overran the route's 300 s and was cut off. It now reads a workspace's repositories four at a time,
each still logged and skipped on its own, and answers them in their order; the target lanes are still
recorded once every repository was read.

## Guard

The reproduction: it fails when a workspace's repositories are read one at a time again, or more than
four at once.

## Mutation

mutation: no changed core file against origin/main (f3322bfd): nothing to mutate
