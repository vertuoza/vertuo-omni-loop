# Bug 1316: a signed-out tab keeps polling the database for the waiting list (42501 permission denied)

## Triage

- **Domain:** The waiting list (the bell) — `apps/galaxy/src/waiting`
- **Risk:** low — no person sees anything wrong: a forgotten signed-out tab sends ~430 refused reads an hour to the production database, filling its error log and hiding real errors; nobody loses data (Jev, 0.81)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/waiting/signed-out.test.ts`
- **Red:** AssertionError: expected Error: read the database to be an instance of SignedOut

## Fix

The waiting provider polls Supabase from the browser (Questions every 5 s, every 15 s hidden; New documents
every 10 s) and kept polling whatever a read answered, so a tab whose sign-in expired read with the public key
and the database refused it forever. The Questions and New documents readers now ask the client for its
session first (`holdSession`, no database request) and, without one, read nothing and throw `SignedOut`;
the provider stops that poll on it.

## Guard

`apps/galaxy/src/waiting/signed-out.test.ts`: a client holding no session gets `SignedOut` from both readers and
no `from` or `rpc` call. It fails on the default branch's readers and passes on this branch.

## Mutation

mutation: no changed core file against origin/main (201c682f): nothing to mutate
