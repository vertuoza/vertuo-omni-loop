# Bug 1854: every GitHub webhook touch downloads every dossier's snapshot

## Triage

- **Domain:** the dossier's live refresh: the GitHub touch webhook (`apps/galaxy/src/touched`, PRD 902 s3)
- **Risk:** high — nobody sees an error: the webhook answers correctly, but about 28 times a minute it reads and parses every dossier's snapshot, adding load to the database every page shares; there is no workaround. (Jev, 0.55)
- **Regression:** new bug — no evidence this ever worked: `snapshotsOf` has read the whole workspace since PRD 902 s3 and filtered by repository in JavaScript

## Reproduction

- **File:** `apps/galaxy/src/touched/store.test.ts`
- **Red:** AssertionError: expected [ [ 'dossier_github', …(2) ] ] to deeply equal [ [ 'dossier_github', …(3) ] ]

## Fix

Every touch read every `dossier_github` row of the workspace (191 rows, 3 MB serialized, 40 ms in
Postgres, 139,487 times) and only then kept the touched repository's in JavaScript. `snapshotsOf` now
filters by repository in SQL (`summary->>repo` ilike the repository, its wildcards escaped, so in any
case as before), and a touch that names no PRD, pull request or issue (a push onto `main`, a branch of no
known topic) reads no snapshot at all. On production the filtered read is 17.6 ms and 13 kB for a
repository with 2 dossiers.

## Guard

The reproduction pins the store's query (the repository filter, with `_` and `%` escaped); in
`touched.test.ts`, the webhook asks the store for the touched repository only, and a touch naming no
PRD, pull request or issue reads none. Red on main, green here.

## Mutation

mutation: no changed core file against origin/main (c7b6b086): nothing to mutate
