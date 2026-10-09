# ADR-0093 — A loop's roadmap is found by matching the plan's PRDs against the inbox's roadmaps

**Status:** adopted · **Date:** 2026-10-08 · **PRD:** #1208 · **Decided:** nobody — adopted when raised (medium), 2026-10-08 · **Merged:** @pierrederval, 2026-10-08, PR #1210

## Context

Whether a loop's roadmap is guessed from its list of PRDs, or written down by the planning step that made the plan.

## Decision

At start, the loop names the one roadmap whose PRD list is exactly the plan's PRD list. When no roadmap or more than one matches, it names none and shows the plain loop; the plan does not record a roadmap number.

The option chosen: A. Match the plan's PRDs against the roadmaps of the inbox: the one roadmap with exactly those PRDs is the loop's (built).

## Consequences

Moving to B is one field in the plan file, set where the roadmap plan is made, and read at start in place of the match: no data to migrate, since loop.json is rewritten at each start.

## Source

`.omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md`, entry `s3-01-loop-roadmap-from-its-prds`
