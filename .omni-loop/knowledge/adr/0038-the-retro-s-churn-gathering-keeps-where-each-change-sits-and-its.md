# ADR-0038 — The retro's churn gathering keeps where each change sits and its size, never the code text

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #72 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #75

## Context

What `gather` in `kinds/churn.mjs` hands `detect` for each file of each commit. The spec's model input includes "the hunks of churn ranges" ("The model, and the guard"), and its units table says `gather` returns "commits with patches". Each step's output is stored by Inngest, which refuses one over its size limit; the patches of a delivery of a hundred commits can pass it.

## Decision

For each file of each commit, churn gathering keeps only the change blocks' positions and line counts, never any code text. The model sees which lines were rewritten, by which commits, with links, but not the code.

The option chosen: A. Keep where each change sits and its size, never the code, the option built.

## Consequences

Showing the model the code of each flagged range is one more field on a range finding, filled by reading those commits again after the counting, in a step the function (`retro.mjs`, slice s8's ground) would add; or by keeping every patch's text in the records and risking the step limit.

## Source

`.omni-loop/delivery/shipped/0072-retro/outbox/settled.md`, entry `s4-02-churn-keeps-no-code-text`
