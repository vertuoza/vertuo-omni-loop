# ADR-0073 — The merge check judges a pull request by its plan's parts and the parts its changes reach, and reads rules from this checkout

**Status:** adopted · **Date:** 2026-10-06 · **PRD:** #1089 · **Decided:** nobody — adopted when raised (medium), 2026-10-06 · **Merged:** @pierrederval, 2026-10-06, PR #1090

## Context

Whether the merge check should judge a pull request by the parts its changes reach as well as the parts its plan names, and whether reading a target repository's own rules belongs in this command or in the later slice that wires the targets.

## Decision

A pull request must meet the rules of every part its plan names and its changes reach; passed, skipped or neutral checks are green, and only a person's latest review counts. With --repo, the other repository's pull request is read but the rules come from this checkout.

The option chosen: A. A. Keep it: the plan's parts and the parts the changes reach, passed, skipped or neutral checks green, a person's latest review, and --repo asks the other repository while the rules come from this checkout.

## Consequences

A constant change in kit/lib/flow/merge-gate.ts and the check merge command in kit/bin/commands/flow.ts, with their tests: judging by the plan's parts alone, counting a skipped check as not green, or reading a target's own config is a few lines; no stored data moves.

## Source

`.omni-loop/delivery/shipped/1089-repo-flow/outbox/settled.md`, entry `s5-01-merge-gate-reading`
