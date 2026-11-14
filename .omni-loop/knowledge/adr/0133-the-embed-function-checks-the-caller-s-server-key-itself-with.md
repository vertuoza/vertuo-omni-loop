# ADR-0133 — The embed function checks the caller's server key itself, with the gateway's token check off

**Status:** adopted · **Date:** 2026-11-12 · **PRD:** #2728 · **Decided:** nobody — adopted when raised (medium), 2026-11-12 · **Merged:** @pierrederval, 2026-11-12, PR #2730

## Context

Keep the function's own key check with the gateway check off (A), or turn the gateway check back on and require the old-style key everywhere (B).

## Decision

Supabase's gateway token check is off for the embed function. The function admits only a caller presenting one of the project's server keys, old or new style, compared in constant time, and refuses everyone else before reading anything.

The option chosen: A. A. The function checks the caller's server key itself, old or new style, with the gateway check off (built).

## Consequences

Going back is one setting and a few lines in the function; nothing stored changes.

## Source

`.omni-loop/delivery/shipped/2728-mcp-meaning-search/outbox/settled.md`, entry `s3-02-embed-checks-its-own-key`
