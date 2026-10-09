# ADR-0082 — The loop keeps every version of its plan in one local, git-ignored file in the checkout

**Status:** adopted · **Date:** 2026-10-07 · **PRD:** #1139 · **Decided:** nobody — adopted when raised (medium), 2026-10-07 · **Merged:** @pierrederval, 2026-10-07, PR #1142

## Context

Where the frozen plan lives so each later round reads it, whether a round may make the first version on its own, and whether naming PRDs follows the kept plan or asks for one answer per PRD.

## Decision

Every plan version lives in one git-ignored file in the checkout's local state; making a plan restarts it at version 1. A round with no plan makes version 1 from the PRDs, and numbers naming exactly the plan's PRDs follow it.

The option chosen: A. A. One local file per checkout with every version; a round with no plan makes version 1; numbers equal to the plan's PRDs follow it.

## Consequences

Small: one file path and two conditions in the command. The loop push slice reads the same file; moving it later means changing both readers, with nothing stored anywhere else.

## Source

`.omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md`, entry `s3-01-plan-kept-in-checkout`
