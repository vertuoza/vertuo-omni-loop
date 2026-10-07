# ADR-0074 — Each plan target is graded against its own copied flow, or the kit's defaults when none was copied

**Status:** adopted · **Date:** 2026-10-06 · **PRD:** #1089 · **Decided:** nobody — adopted when raised (medium), 2026-10-06 · **Merged:** @pierrederval, 2026-10-06, PR #1090

## Context

Whether the copy's layout, the fallback for targets without a copied flow, the per-repository reading of rules across slices, and reporting a moved flow as an out-of-date target are what the team wants before the merge-wide skills follow them.

## Decision

Each imported target's flow and hooks sit in a flow folder in its copy, and each repository's rows are graded against its own flow. A target with no copied flow meets the kit's defaults. A target whose flow changed since copying is listed as stale, naming its flow.

The option chosen: A. A. Keep it: rules and hooks kept in the copy's flow folder, the usual rules for a target with no copied rules, rules read one repository at a time, and changed rules reported as an out-of-date target.

## Consequences

A constant change in kit/lib/plan-repo/copy-flow.ts, kit/lib/inbox/plan-grade.ts and kit/lib/plan-repo/targets.ts with their tests: another file name, grading targets without a copy against the plan repository's own flow, reading rules across repositories, or a separate moved state are each a few lines; no stored data moves.

## Source

`.omni-loop/delivery/shipped/1089-repo-flow/outbox/settled.md`, entry `s6-01-target-flow-copy-and-grading`
