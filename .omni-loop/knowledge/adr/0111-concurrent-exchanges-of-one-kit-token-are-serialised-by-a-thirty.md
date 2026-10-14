# ADR-0111 — Concurrent exchanges of one kit token are serialised by a thirty-second hold, with the second exchange retrying

**Status:** adopted · **Date:** 2026-10-12 · **PRD:** #1628 · **Decided:** nobody — adopted when raised (medium), 2026-10-11 · **Merged:** @pierrederval, 2026-10-12, PR #1629

## Context

Keep the thirty-second hold the exchange takes on the token, or ask for a different way to put two exchanges one after the other.

## Decision

The first exchange of a token takes a hold on it lasting at most thirty seconds. A second exchange that finds it held retries every quarter second for up to ten seconds, then answers try again.

The option chosen: A. A. A thirty-second hold taken by the first exchange; the second waits and claims again, up to ten seconds (built)

## Consequences

Changing the wait is a constant in galaxy; dropping the hold for something else is a follow-up migration that drops two columns.

## Source

`.omni-loop/delivery/shipped/1628-cloud-sign-in/outbox/settled.md`, entry `s1-01-exchange-lease`
