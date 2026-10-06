# ADR-0060 — The saved season is keyed on the newest event, the event count, the sectors and fleets, and the UTC day

**Status:** adopted · **Date:** 2026-09-29 · **PRD:** #657 · **Decided:** nobody — adopted when raised (medium), 2026-09-29 · **Merged:** @pierrederval, 2026-09-29, PR #664

## Context

Whether the saved season follows only the newest event and the day, as the spec says, or also the event count and the fleets and sectors.

## Decision

The cached season's key carries the workspace, the newest event's id and time, the event count, a fingerprint of the sectors and fleets, and the UTC day, so a late event or a fleet or sector edit shows at once.

The option chosen: A. Key on the newest event, the event count, the sectors and fleets, and the UTC day (built).

## Consequences

Nothing to undo but the key: dropping the count and the fingerprint from seasonKey is a one-line change, and the cache refills on its own.

## Source

`.omni-loop/delivery/shipped/0657-snappy-pages/outbox/settled.md`, entry `s8-01-season-cache-key-wider`
