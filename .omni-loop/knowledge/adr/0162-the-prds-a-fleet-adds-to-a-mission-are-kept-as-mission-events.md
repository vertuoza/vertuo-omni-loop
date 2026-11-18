# ADR-0162 — The PRDs a fleet adds to a mission are kept as mission events, never written into the mission's scope

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2896 · **Decided:** nobody — adopted when raised (medium), 2026-11-16 · **Merged:** @pierrederval, 2026-11-16, PR #2897

## Context

Whether the fleet's PRDs should also be written into the mission's scope, so other readers see them without reading its history.

## Decision

Each PRD a fleet adds is a prd-added mission event, and each roadmap row the cap leaves out is a not-written event. The mission's scope stays as the person wrote it; the supervisor and the Missions tab add the fleet's PRDs from these events on every read.

The option chosen: A. A. History entries only, the scope left as the person wrote it (built).

## Consequences

A database function that appends to missions.scope, and the readers that would then read the scope alone.

## Source

`.omni-loop/delivery/shipped/2896-fleet-alone/outbox/settled.md`, entry `s12-04-fleet-prds-kept-as-events-not-scope`
