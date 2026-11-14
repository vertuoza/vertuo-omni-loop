# ADR-0142 — A mission sees an answered PRD carry on only through its stage, not through the page's auto-fix jobs

**Status:** adopted · **Date:** 2026-11-14 · **PRD:** #2842 · **Decided:** nobody — adopted when raised (medium), 2026-11-14 · **Merged:** @pierrederval, 2026-11-14, PR #2843

## Context

Whether a PRD waiting on answers is seen moving on only through its stage (ready, then merged), as built, or whether the mission should also follow the runner jobs the page's auto-fix sends for it, and react to their ends as it does to its own.

Decided by: Jev (hardToRevert 0.40) · agent said false

## Decision

A mission keeps a PRD waiting on answers until its stage reads ready, then waits for its merge; it never follows the auto-fix jobs the page runs after an answer, and never sends that PRD again itself.

The option chosen: A. The PRD carries on by its stage: ready, then merged (built).

## Consequences

A constant and one more read: following the auto-fix jobs means reading the runner jobs of the PRD's line beside the mission's own, and mapping their ends with the same table. No stored shape changes.

## Source

`.omni-loop/delivery/shipped/2842-missions/outbox/settled.md`, entry `s4-02-answered-prd-carries-on-by-its-stage`
