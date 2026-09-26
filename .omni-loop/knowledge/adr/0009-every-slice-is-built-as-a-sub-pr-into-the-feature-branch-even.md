# ADR-0009 — Every slice is built as a sub-PR into the feature branch, even when the plan has only one slice

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #7 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #9

## Context

Whether a one-slice plan skips the sub-PR (upstream) or keeps it.

## Decision

A PRD small enough to be one slice still gets its own sub-PR into the feature branch, so building, checking and merging follow a single path. The feature PR never doubles as a slice's PR.

The option chosen: A. Always a sub-PR, one slice or many

## Consequences

One extra branch and PR for tiny PRDs; reverting means a one-slice path in do-work, wave and board.

## Source

`.omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md`, entry `s7-02-one-slice-still-a-sub-pr`
