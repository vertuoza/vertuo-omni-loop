# ADR-0084 — The Loop page reads the kit's plan as numbered steps and shows any other shape as unreadable

**Status:** adopted · **Date:** 2026-10-07 · **PRD:** #1139 · **Decided:** nobody — adopted when raised (medium), 2026-10-07 · **Merged:** @pierrederval, 2026-10-07, PR #1142

## Context

Whether the kit's loop plan should be pushed as `{steps: [{step, prd, slice?, wave?, action?, after?: {prd, slice?, reason}, beside?}]}`, the shape the page reads.

## Decision

The Loop page expects the kit's plan as numbered steps, each naming its PRD, slice or action, the step it waits on and why, and whether it may run beside another. A plan in any other shape is shown as unreadable, while the ledger and parked PRDs still show.

The option chosen: A. The page reads numbered steps with prd, slice, wave, action, after (prd, slice, reason) and beside, and shows any other shape as unreadable

## Consequences

A constant: the reader is one zod schema in `apps/galaxy/src/loop/page/view.ts` (`readPlan`); matching another shape changes that schema only, no migration, since the app stores the plan as it came.

## Source

`.omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md`, entry `s5-01-loop-plan-shape-read`
