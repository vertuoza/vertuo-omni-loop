# Bug 2953: every GitHub request the app makes costs 2–3 database round-trips, keeping the database above 80% CPU

## Triage

- **Domain:** the shared GitHub client and its store (`packages/github`, `apps/galaxy/src/dossier/github/server.ts`)
- **Risk:** high — every person on the Omni page waits seconds on each page that reads GitHub, and the shared database nears saturation; the pages still answer, slowly, with no workaround (Jev, 0.84)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/dossier/github/server.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected 3 to be 1` (three reads of one URL asked `github_etags` three times), `AssertionError: expected 2 to be 1` (a 200 repeating the body under a new token's ETag wrote the row again), and in `packages/github/src/client.test.ts` `AssertionError: expected 10 to be 1` (ten reads below the background floor wrote `github_budget` ten times)

## Fix

Every GitHub read asked the database for its ETag, every 200 wrote its whole body back even when only the token's ETag had changed, and below 22% of the limit every answer wrote the budget. A new `rememberingGithubStore` (`packages/github/src/remembering-store.ts`) keeps each server instance's ETags in a bounded least-recently-used memory in front of Supabase, used by galaxy's `githubStore()` and omni-app's `githubStoreOf`; a repeated body is written at most once a day, so the sync's prune of idle ETags keeps its row. The client now writes the budget below the floor only when an answer crosses the floor, moves it 2% or the stored one is a minute old.

## Guard

The reproduction: `server.test.ts` counts the database queries a GitHub read makes through the server's store, so a change that puts a round-trip back on every read fails it.

## Mutation

mutation: no changed core file against origin/main (7bfc0391): nothing to mutate
