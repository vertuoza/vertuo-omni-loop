# Bug 674: Visual Updates and Bug Fixes are always empty under Mine

## Triage

- **Domain:** Work › fix lists (`/visual`, `/bugs`)
- **Risk:** medium — every signed-in person lands on an empty Visual Updates and Bug Fixes list (Mine is the default); workaround: click All
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/fixes/list.test.ts`
- **Red:** AssertionError: expected [] to deeply equal [ Array(1) ]

## Fix

Mine kept only dossiers whose `opened_by` was the viewer, but fix dossiers are created by the repository sync with no `opened_by`, so Mine could never hold one. Mine now also keeps a fix whose issue the viewer opened on GitHub (the row's *asked by*, compared with the viewer's GitHub login in any case); the route hands the list the viewer's id and login, and the empty Mine now says "You have not asked for a … yet."

## Guard

`apps/galaxy/src/fixes/routes.test.ts` › "keeps under Mine a fix someone else pushed whose issue the viewer opened on GitHub": signed in with a GitHub login, /visual's Mine shows the fix that login asked for; it fails when the route hands the list only the user id.

## Mutation

not set here
