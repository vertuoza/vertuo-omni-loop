# ADR-0173 — Undo of a notebook line deletion is a 5-second hold on the page, and the database never restores a line

**Status:** adopted · **Date:** 2026-11-21 · **PRD:** #3107 · **Decided:** nobody — adopted when raised (medium), 2026-11-20 · **Merged:** @pierrederval, 2026-11-21, PR #3110

## Context

The drawer shows Deleted by <login> · <time> with Undo for 5 seconds, then calls commander_note_delete(); leaving the tab sends what waits at once. The database has no restore: a deletion is recorded once, never undone.

## Decision

The page waits 5 seconds before calling the delete, and Undo cancels that wait; leaving the tab sends any waiting delete at once. The database records each deletion once and has no restore, so who deleted a line is never erased.

The option chosen: A. Hold the deletion 5 seconds on the page, then send it; the database never restores a line.

## Consequences

Low: a restore function and an undo call can be added later without changing the stored lines.

## Source

`.omni-loop/delivery/shipped/3107-fleet-commander/outbox/settled.md`, entry `s4-02-undo-holds-the-delete`
