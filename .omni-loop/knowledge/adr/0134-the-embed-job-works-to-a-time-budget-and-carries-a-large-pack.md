# ADR-0134 — The embed job works to a time budget and carries a large pack over several runs

**Status:** adopted · **Date:** 2026-11-12 · **PRD:** #2728 · **Decided:** nobody — adopted when raised (medium), 2026-11-12 · **Merged:** @pierrederval, 2026-11-12, PR #2730

## Context

Whether a large pack is embedded over several short runs (as built), or the run is given more time.

## Decision

The embed job stops after about 150 seconds, keeps every batch it already finished, and schedules itself again a minute later to embed what is left, rather than embedding a whole pack in one run or one job per batch.

The option chosen: A. A. Stop after about 150 seconds, keep what is done, and run again a minute later (built).

## Consequences

Changing it is one constant (the run's time budget) in the embed job.

## Source

`.omni-loop/delivery/shipped/2728-mcp-meaning-search/outbox/settled.md`, entry `s4-01-embed-job-runs-again-when-out-of-time`
