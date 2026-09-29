# Bug 642: the stage sync re-reads every pull request of every repository every 15 minutes and exhausts the GitHub App's hourly budget

## Triage

- **Domain:** galaxy's stages sync (PRD 587), `apps/galaxy/src/stages/sync/`
- **Risk:** medium — once the shared App installation's hourly budget is spent (seen 2026-09-29 around 13:00 UTC, GitHub 403 on every repository), the sync, the outbox check, the retro, the knowledge map and the Engineering board fail for up to an hour; the only workaround is waiting for the budget to reset.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/stages/sync/github.test.ts`
- **Red:** AssertionError: expected [ [ 'created', 'desc', '1' ], …(2) ] to deeply equal [ [ 'updated', 'desc', '1' ], …(1) ]

## Fix

Every run read each repository's pull requests (up to 20 pages of 100) and its PRD issues in full. Now, after a repository's first sync, the reader lists pull requests most recently updated first and stops at the first page holding one updated before the last sync, and passes `since` for issues; with no last sync it reads everything as before, and the folders are still read in full. The last sync is the latest `prd_stages.synced_at` of the repository's PRD stages (only the sync writes those; stage events never do), less five minutes — no new table or column, and a stage already stored keeps its date.

## Guard

`apps/galaxy/src/stages/sync/sync.test.ts` › "reads a repository in full on its first sync, then only what changed since it, five minutes early": catches a sync that hands the reader no last-sync time; it failed on the default branch's `sync.ts` and passes on the fix branch.

## Mutation

not set here — three hand mutations of the reader's fixed lines (no stop at an older page, no filter of older pull requests, no `since` on issues) each turned a test red
