# ADR-0151 — A stopped Reviewer or fix step is sent again as the same step, once, and only the build waits on the approval

**Status:** adopted · **Date:** 2026-11-15 · **PRD:** #2871 · **Decided:** nobody — adopted when raised (medium), 2026-11-14 · **Merged:** @pierrederval, 2026-11-15, PR #2872

## Context

Keep the same step sent again (A), or send the build again and let it hand over to the Reviewer as before (B).

Decided by: Jev (hardToRevert 0.40) · agent said false

## Decision

When the Reviewer or its fix stops half-way, the mission sends that same step again once under the next run's key, rather than restarting from the build. A second stop stops the PRD; only build steps are held by the approval and blocker checks.

The option chosen: A. A. Send the same step again once, under run 2; steps after the build skip the approval check (built).

## Consequences

A change to one function of the supervisor and its tests: the keys already allow both shapes, and no stored row depends on which one is used.

## Source

`.omni-loop/delivery/shipped/2871-reviewer/outbox/settled.md`, entry `s5-01-reviewer-sent-again-same-step`
