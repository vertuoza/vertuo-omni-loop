# ADR-0011 — The planner keeps an existing plan and repairs it only as far as the slice rules and plan check require

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #7 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #9

## Context

Whether /omni:plan keeps and repairs an existing plan.md, or always writes a fresh one.

## Decision

When plan.md already exists for a PRD, /omni:plan keeps it and changes only what the slicing rules and omni plan check require, rather than rewriting it or stopping to ask.

The option chosen: A. Keep an existing plan, repair only what the check or slice rules need

## Consequences

One sentence in the skill.

## Source

`.omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md`, entry `s7-04-existing-plan-kept`
