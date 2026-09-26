# ADR-0033 — omni signout forgets the sign-in on this computer only and does not end it on the server

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #71 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #73

## Context

The spec: "`signout` deletes them" (the tokens), and the contract under `/api/ask/*` has no call that ends a sign-in on the server. Ending it there would need either a new contract call, which this slice may not add on its own (the plan: a slice that needs to change the contract raises an item), or the kit calling Supabase Auth's logout directly, which would tie the kit to Supabase instead of to the contract.

## Decision

omni signout removes the host's entry from the local credentials file and tells no server, so a token copied earlier keeps working until it expires. Ending it server-side would need a new contract call, not a direct Supabase Auth call.

The option chosen: A. Forget the sign-in on this computer only, the option built.

## Consequences

Adding a server-side sign-out later is one new contract call, one route and a few lines in the command; nothing stored changes.

## Source

`.omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md`, entry `s3-03-signout-forgets-on-this-computer`
