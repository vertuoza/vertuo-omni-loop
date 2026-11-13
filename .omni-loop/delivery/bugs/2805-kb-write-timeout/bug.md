# Bug 2805: omni kb writes report the Omni page unreachable although the write was saved

## Triage

- **Domain:** product-knowledge, its terminal writes (`kit/lib/ask/client.ts`, `kit/bin/kb-write.ts`)
- **Risk:** medium — a member writing a product's knowledge from the terminal is told the write failed when it was saved, and a retry duplicates the entry; the workaround is to read the list before retrying.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/ask/client-knowledge-write.test.ts`
- **Level:** unit
- **Red:** Caused by: AskCallError: POST /api/knowledge/changes: timed out

## Fix

`changeKnowledge` sent `POST /api/knowledge/changes` with the client's ordinary 5 s call timeout, while the route may run up to 30 s, so a slow save was cut and reported as "the Omni page could not be reached". The write now waits up to 30 s (`WRITE_TIMEOUT_MS`), and a write that still times out says the change may be saved and names the `omni kb <kind>` read to run before trying again.

## Guard

`kit/lib/ask/write-timeout-guard.test.ts`: the write timeout is at least the route's `maxDuration`; it fails at the old 5 s.

## Mutation

mutation: no changed core file against origin/main (1f39554a): nothing to mutate
