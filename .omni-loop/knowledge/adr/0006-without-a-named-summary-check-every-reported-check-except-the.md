# ADR-0006 — Without a named summary check, every reported check except the outbox check decides that a pull request is green

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #7 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #9

## Context

What `/omni:pr` counts as green when `ci.branchProtection` is false and `ci.aggregateCheck` is null (this repository's own case).

## Decision

When no branch protection exists and no summary check is named, /omni:pr counts every reported check except the outbox check as the CI gate. With a named summary check, only that check and the outbox check count.

The option chosen: A. Every reported check except the outbox check counts, the option built.

## Consequences

One paragraph of `kit/plugin/skills/pr/SKILL.md`.

## Source

`.omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md`, entry `s4-02-checks-without-aggregate`
