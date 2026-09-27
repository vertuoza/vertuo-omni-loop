# ADR-0044 — Joining the company workspace at sign-in is best-effort and never fails the sign-in

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #100 · **Decided:** nobody — adopted when raised (medium), 2026-09-26 · **Merged:** @pierrederval, 2026-09-26, PR #101

## Context

What the auth callback does when `join_by_domain()` fails after a sign-in. The spec says the callback calls it after every sign-in, beside `link_github()`, and that the page calls it once more for a person with no membership; it does not say whether a failed call stops the sign-in.

## Decision

When join_by_domain() fails after a sign-in, the auth callback logs the failure and carries on; the arcade page joins once more, and link_github() or ask_cli_code_issue() refuse a person in no workspace with their own message.

The option chosen: A. Carry on, log the failure, and let the page join once more. This is what was built.

## Consequences

A few lines in `apps/galaxy/src/data/sign-in.ts` and their tests: returning a `signin_error` instead of carrying on.

## Source

`.omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md`, entry `s5-03-joining-at-sign-in-is-best-effort`
