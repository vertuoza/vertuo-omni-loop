# ADR-0064 — With the question category On, the old sorter still answers every round beside Jev

**Status:** adopted · **Date:** 2026-09-30 · **PRD:** #812 · **Decided:** nobody — adopted when raised (medium), 2026-09-30 · **Merged:** @pierrederval, 2026-09-30, PR #814

## Context

Whether a round whose category decision is On still calls the old sorter (Haiku through OpenRouter) alongside Jev, or calls it only when Jev fails or answers under the floor.

## Decision

When the category decision is On, each round still asks the old sorter (Haiku through OpenRouter) alongside Jev. Jev's answer counts when it clears the floor; otherwise the old answer counts at once. Both answers are logged for comparison.

The option chosen: A. A. On still asks the old sorter every round, so the record keeps comparing and the fallback is immediate.

## Consequences

One branch in the resolver's decide step: run the old path after Jev instead of beside it. No stored data changes.

## Source

`.omni-loop/delivery/shipped/0812-jev-decisions/outbox/settled.md`, entry `s2-01-on-mode-still-asks-haiku`
