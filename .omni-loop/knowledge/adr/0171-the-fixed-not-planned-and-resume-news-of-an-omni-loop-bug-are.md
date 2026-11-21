# ADR-0171 — The fixed, not-planned and resume news of an Omni Loop bug are all bug-fixed mission events, told apart by their sentence

**Status:** adopted · **Date:** 2026-11-19 · **PRD:** #3088 · **Decided:** nobody — adopted when raised (medium), 2026-11-19 · **Merged:** @pierrederval, 2026-11-19, PR #3089

## Context

Which event kind carries the not-planned news and the resume, since the spec names only bug-fixed among the new kinds and the older kinds already have one-per-PRD meanings.

## Decision

A mission records that a bug it waited on was fixed, will not be fixed, or that its PRD went again as bug-fixed events, each with its own sentence and the public issue's link. Each is keyed so a replay never records it twice.

The option chosen: A. All three as bug-fixed events, told apart by their sentence (built).

## Consequences

Splitting them later takes a migration widening the kinds and a change to the room's reading.

## Source

`.omni-loop/delivery/shipped/3088-omni-bug-team/outbox/settled.md`, entry `s5-04-one-event-kind`
