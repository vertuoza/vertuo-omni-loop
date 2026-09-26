# ADR-0032 — The CLI sign-in codes are reached only through two security-definer database functions, not a service-role key

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #71 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #73

## Context

The spec: "The CLI-code table is service-role only." The galaxy app holds only the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`): every ask call runs as the caller, and no service-role key is configured or read anywhere in `apps/galaxy`. Yet the callback must write a code, and `/api/ask/token` must read and delete it for a caller who is not signed in yet.

## Decision

ask_cli_codes has row-level security with no policy and no anon or authenticated grant. The galaxy app, holding only the anon key, issues a code through ask_cli_code_issue and uses it up once through ask_cli_code_redeem.

The option chosen: A. Keep the codes behind two narrow database steps, with no direct access for anyone signed in or not, the option built.

## Consequences

Moving to a service-role key later means a secret on the deployment, a server-only client, and a migration dropping the two functions; the table and the codes' shape stay.

## Source

`.omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md`, entry `s3-02-codes-kept-behind-two-steps`
