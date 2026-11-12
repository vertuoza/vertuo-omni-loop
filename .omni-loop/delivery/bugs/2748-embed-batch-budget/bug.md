# Bug 2748: the embed function fails in production, so no knowledge vector is stored

## Triage

- **Domain:** product knowledge: meaning search (the embed Edge Function, the knowledge-embed job, the MCP's search)
- **Risk:** medium — every product MCP search answers by words instead of by meaning; nothing breaks
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/knowledge-embed/embedder.budget.test.ts`
- **Level:** unit
- **Red:** `Error: embed answered 546` (and, in `supabase/functions/embed/budget.test.ts`, `AssertionError: expected 64 to be less than or equal to 8`)

## Fix

Each call to the embed Edge Function carried up to 64 texts of up to 2,000 characters, more than gte-small can embed within an Edge Function's CPU budget, so it answered 546 and the job tried the same batch again forever. The function now takes at most 8 texts a call, both callers send at most 8, and the App's client splits a batch the function answers 546 or 503 to in halves, down to one text, so the job always moves on.

## Guard

`supabase/functions/embed/budget.test.ts`: the function's batch stays at 8 or fewer, and neither caller (the App's job, the MCP's search) ever sends more than the function takes.

## Mutation

mutation: no changed core file against origin/main (efd6ee20): nothing to mutate
