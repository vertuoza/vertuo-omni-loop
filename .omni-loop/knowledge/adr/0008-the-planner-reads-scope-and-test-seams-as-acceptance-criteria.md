# ADR-0008 — The planner reads scope and test seams as acceptance criteria when a PRD has no acceptance section

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #7 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #9

## Context

Whether /omni:plan may read scope and test seams as acceptance criteria when the spec has no acceptance section, or must stop on every spec that lacks one.

## Decision

/omni:plan reads a PRD's acceptance section, or else its scope and test seams. It stops and asks only when some slice's done-when cannot be written as an observable condition.

The option chosen: A. Acceptance section, else scope and test seams, graded by whether every slice's done-when is observable

## Consequences

One paragraph of the skill; a later spec template with a mandatory acceptance section would make the fallback unused.

## Source

`.omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md`, entry `s7-01-acceptance-from-scope-and-seams`
