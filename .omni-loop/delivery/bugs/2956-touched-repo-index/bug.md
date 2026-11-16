# Bug 2956: every GitHub webhook reads all dossier summaries to find its repository

## Triage

- **Domain:** GitHub webhooks: the touched snapshots (`apps/galaxy/src/touched/store.ts`, table `dossier_github`)
- **Risk:** high — every member of every workspace gets slower pages while the database CPU is above 80%; nothing is lost or wrong, and there is no workaround (Jev, 0.79)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `supabase/checks/touched_lookup.sql`, with `apps/galaxy/src/touched/store.test.ts`
- **Level:** unit
- **Red:** `psql:/tmp/checks-2956/touched_lookup.sql:63: ERROR:  FAIL: dossier_github has no repo_key to look a repository up by: every touch reads every summary of the workspace`

## Fix

`snapshotsOf` matched `summary->>'repo'` with `ilike`, which no index serves, so every webhook
decompressed every summary of its workspace (97 ms at 775 rows in production, 22% of the database's
time). A migration adds `repo_key`, the summary's repository in lower case that Postgres derives
and keeps, with an index on `(workspace_id, repo_key)`, and the lookup is now an equality on it: an
index scan reading no other repository's row.

## Guard

`supabase/checks/touched_lookup.sql`, run by the `supabase` workflow: at production's size, it
fails when the lookup by repository uses no index, finds the wrong rows, or `repo_key` stops
following the summary.

## Mutation

mutation: no changed core file against origin/main (7bfc0391): nothing to mutate
