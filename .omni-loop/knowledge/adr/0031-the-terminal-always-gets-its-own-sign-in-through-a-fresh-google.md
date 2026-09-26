# ADR-0031 — The terminal always gets its own sign-in through a fresh Google sign-in, never sharing the browser's session

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #71 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #73

## Context

The spec says the callback hands the CLI a one-time code bound to the account, stored with a `refresh_token`, but not whose sign-in that token belongs to. The galaxy's Supabase Auth rotates refresh tokens (`enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10` in `supabase/config.toml`): if the browser's cookie session and the terminal held the same refresh token, the first to renew it would make the other's next renewal a reuse past the interval, which Supabase treats as theft and answers by revoking the whole session, on both sides.

## Decision

CLI sign-in always runs a fresh Google sign-in whose session is never written to or read from browser cookies. The terminal keeps tokens that were never in the browser, because with refresh-token rotation a shared token would get both sides' session revoked.

The option chosen: A. The terminal always gets its own sign-in, through a fresh Google sign-in, the option built.

## Consequences

A change of two files: reusing the browser's session instead would read its cookies in the callback and skip the Google round trip. Nothing stored depends on the choice.

## Source

`.omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md`, entry `s3-01-terminal-gets-its-own-sign-in`
