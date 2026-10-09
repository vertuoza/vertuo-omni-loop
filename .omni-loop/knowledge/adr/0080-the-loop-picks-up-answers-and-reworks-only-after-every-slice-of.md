# ADR-0080 — The loop picks up answers and reworks only after every slice of the feature is merged

**Status:** adopted · **Date:** 2026-10-07 · **PRD:** #1139 · **Decided:** nobody — adopted when raised (medium), 2026-10-07 · **Merged:** @pierrederval, 2026-10-07, PR #1142

## Context

Whether answers posted mid-build should interrupt the waves, and whether an objection to an adopted decision should wake the rework step.

## Decision

Answers posted mid-build never interrupt the waves: the answer check counts only once every slice is merged, reading the feature branch's open questions against the feature PR's replies. Objections to adopted decisions are left to the rework skill.

The option chosen: A. Finish building first, then rework on the answers; objections to adopted decisions wait for the rework skill.

## Consequences

Small: one condition in the verdict and one extra read of the settled ledger. No stored shape.

## Source

`.omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md`, entry `s1-01-answers-after-build`
