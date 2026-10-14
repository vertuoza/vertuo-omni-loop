# ADR-0109 — The design review does not run on a slice built in a target repository, and its section says so in one line

**Status:** adopted · **Date:** 2026-10-11 · **PRD:** #1369 · **Decided:** nobody — adopted when raised (medium), 2026-10-10 · **Merged:** @pierrederval, 2026-10-11, PR #1371

## Context

Whether a slice built in a target repository gets a design review from the source alone, from the target's own settings, or none.

## Decision

Under --target, do-work skips the design review, because the planning repository never starts the target's app. The sub-PR's Design review section says in one line that it was not run on a target slice.

The option chosen: A. Skip the review on a target slice, with one line saying so (built)

## Consequences

One sentence of the do-work skill; turning it on later reads the target's committed design flag, as its preflight is read.

## Source

`.omni-loop/delivery/shipped/1369-design-craft/outbox/settled.md`, entry `s4-02-no-design-review-on-a-target-slice`
