# ADR-0083 — The plan orders work as one step per PRD wave plus a finish step, lower PRD number first, with stuck PRDs giving way and parked PRDs passed over

**Status:** adopted · **Date:** 2026-10-07 · **PRD:** #1139 · **Decided:** nobody — adopted when raised (medium), 2026-10-07 · **Merged:** @pierrederval, 2026-10-07, PR #1142

## Context

The size of a step, the order between two PRDs whose slices share ground, and what the loop does with the steps of a PRD parked on a person.

## Decision

Each PRD's waves become steps in order, then one finish step for gate and review. Between PRDs, blockers go first, then PRDs with no stuck slice, then the lower number; a PRD parked on a person is passed over, and the loop stops only when nothing can move.

The option chosen: A. A. A step per wave plus a finish step; lower number first, stuck PRDs give way; parked PRDs passed over.

## Consequences

Small: the order is one sort key in the plan and one rule in following it; plans are recomputed, nothing stored needs moving.

## Source

`.omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md`, entry `s3-02-plan-step-order`
