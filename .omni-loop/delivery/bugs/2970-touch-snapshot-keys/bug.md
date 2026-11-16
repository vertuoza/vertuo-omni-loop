# Bug 2970: a GitHub webhook downloads every snapshot of its repository whole to find the few it touches

## Triage

- **Domain:** the webhook touch's read of the GitHub snapshots (`apps/galaxy/src/touched/store.ts`, `dossier_github`)
- **Risk:** high — every member of every workspace waits on a database whose top consumer (28% of its time) is this read on every GitHub webhook; nothing breaks and there is no workaround (Jev, 0.63)
- **Regression:** new bug — no evidence this ever worked: the touch has read whole summaries since PRD 902 (s3); #2958 cut the rows to one repository, and the bytes grew with the summaries

## Reproduction

- **File:** `apps/galaxy/src/touched/store.test.ts`
- **Level:** unit
- **Red:** FAIL  apps/galaxy/src/touched/store.test.ts > snapshotsOf > reads only the keys a touch matches on, never the whole summary of each snapshot (#2970); and the database check: `psql:/tmp/checks/dossier_github.sql:217: ERROR:  column "prd" does not exist`

## Fix

`snapshotsOf` selected `dossier_id, summary`, so every webhook received every snapshot of its repository whole (about 1 MB for a busy one) to match the touch on the PRD's number, its issue's and its pull requests'. A migration stores those numbers as columns the database generates from the summary (`prd`, `issue`, `pulls`), and the read selects them with the dossier's home repository, never the summary; the runners' fix page, the one caller that needs a summary whole, reads that one row by `prd`. On a local stack shaped like production's, through PostgREST, the busiest repository's read went from 1,608,192 bytes and 4.85 ms in the database to 25,541 bytes and 0.62 ms.

## Guard

`supabase/checks/dossier_github.sql`, run by the `supabase` workflow on every database change: `prd`, `issue` and `pulls` are the summary's numbers, an unread or missing part gives none, and they cannot be written apart from the summary. The unit test pins the touch's select to those columns, without the summary.

## Mutation

mutation: no changed core file against origin/main (cc1c586a): nothing to mutate
