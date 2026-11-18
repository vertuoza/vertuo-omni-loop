# ADR-0160 — A mission merges the new mission-branch tip into each feature branch, under the lease of its head, and rebases only the mission branch

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2896 · **Decided:** nobody — adopted when raised (medium), 2026-11-15 · **Merged:** @pierrederval, 2026-11-16, PR #2897

## Context

Keep merging the new tip into feature branches, or ask for a true rebase of each one, with a forced write under any work still on it.

## Decision

When the mission branch moves, the app merges its new tip into each open feature branch, as GitHub's Update branch does, only while that branch's head is still the one it read. Only the mission branch is rebased, keeping one commit per PRD.

The option chosen: A. A. Merge the new tip into each feature branch, under the lease of its head (built).

## Consequences

Switching to a rebase later costs one function in the mission's keeping up and its tests; nothing stored changes.

## Source

`.omni-loop/delivery/shipped/2896-fleet-alone/outbox/settled.md`, entry `s5-02-feature-branches-merged-not-rebased`
