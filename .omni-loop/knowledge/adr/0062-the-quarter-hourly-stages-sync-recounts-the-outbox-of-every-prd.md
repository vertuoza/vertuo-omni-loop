# ADR-0062 — The quarter-hourly stages sync recounts the outbox of every PRD at building or outbox from GitHub

**Status:** adopted · **Date:** 2026-09-29 · **PRD:** #657 · **Decided:** nobody — adopted when raised (medium), 2026-09-29 · **Merged:** @pierrederval, 2026-09-29, PR #664

## Context

Whether the stages sync reads the GitHub summary of every PRD at building or outbox on each 15-minute run, as built, or only when a stage event or a Send says something changed.

## Decision

Every 15-minute sync reads one GitHub outbox summary per PRD at building or outbox and stores zero for all other PRDs without a request. A summary that cannot be read keeps the stored count.

The option chosen: A. Recount every PRD at building or outbox on each quarter-hourly run (built).

## Consequences

Changing when the sync recounts is a code change in the sync alone; nothing stored changes shape.

## Source

`.omni-loop/delivery/shipped/0657-snappy-pages/outbox/settled.md`, entry `s5-03-sync-reads-active-outboxes`
