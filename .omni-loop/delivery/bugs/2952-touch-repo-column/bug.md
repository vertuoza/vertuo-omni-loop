# Bug 2952: the touch's read of the GitHub snapshots detoasts every summary of the workspace on each webhook (36% of database time)

## Triage

- **Domain:** the webhook touch's read of the GitHub snapshots (`apps/galaxy/src/touched/store.ts`, `dossier_github`)
- **Risk:** high — every member of every workspace waits seconds on every Omni app page and endpoint while the database runs above 80% CPU; nothing breaks outright and there is no workaround (Jev, 0.72)
- **Regression:** new bug — no evidence this ever worked: the jsonb filter came with #1855 (fix of #1854), which already cut a worse read, and its cost grew with the size of the stored summaries

## Reproduction

- **File:** `apps/galaxy/src/touched/store.test.ts`
- **Level:** unit
- **Red:** FAIL  apps/galaxy/src/touched/store.test.ts > snapshotsOf > filters on the indexed lower-case repo column, never on the jsonb summary, so no summary is read to filter (#2952); and the database check: `psql:/tmp/checks/dossier_github.sql:190: ERROR:  column "repo" does not exist`

## Fix

`snapshotsOf` filtered `dossier_github` on `summary->>repo ilike <repository>`, which no index holds, so each webhook detoasted every summary of the workspace (~5 MB in production, ~54 ms a call, ~480k calls a month). A migration adds `repo`, a stored column the database generates as `lower(summary->>'repo')`, and an index on `(workspace_id, repo)`; the read now filters `.eq('repo', repository.toLowerCase())`, the same case-insensitive match. On a local table shaped like production's (775 rows, 5.3 MB of summaries, 60 kB the largest), the filter went from a sequential scan of 2,860 buffers in 1.3 ms to an index scan of 12 buffers in 0.016 ms.

## Guard

`supabase/checks/dossier_github.sql`, run by the `supabase` workflow on every database change: the column always equals the summary's repository in lower case, cannot be written apart from it, and the read by repository plans through `dossier_github_workspace_repo_idx`. The unit test pins the store's filter to that column. No other read filters on `summary->>repo`.

## Mutation

mutation: no changed core file against origin/main (7bfc0391): nothing to mutate
