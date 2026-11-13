# ADR-0132 — Unused knowledge vectors are forgotten by a nightly pg_cron job in the database

**Status:** adopted · **Date:** 2026-11-12 · **PRD:** #2728 · **Decided:** nobody — adopted when raised (medium), 2026-11-12 · **Merged:** @pierrederval, 2026-11-12, PR #2730

## Context

Keep the nightly clean-up (A), or have the App's job ledger run it instead (B), or run it by hand only (C).

## Decision

A pg_cron job runs knowledge_vectors_forget() every night, as ask_expire() is run, deleting vectors no search or job used for 90 days. It does not run on the App's job ledger, so nobody has to remember to run it.

The option chosen: A. A. A pg_cron job runs knowledge_vectors_forget() every day, as ask_expire() is run today.

## Consequences

Changing it is one follow-up migration that unschedules the job (and, for B, one job kind in the App).

## Source

`.omni-loop/delivery/shipped/2728-mcp-meaning-search/outbox/settled.md`, entry `s2-01-vectors-forget-daily`
