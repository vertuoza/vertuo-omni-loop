# ADR-0118 — The retro sends at most one runner job per retro pull request, whatever that job's state

**Status:** adopted · **Date:** 2026-10-22 · **PRD:** #2338 · **Decided:** nobody — adopted when raised (medium), 2026-10-22 · **Merged:** @pierrederval, 2026-10-22, PR #2339

## Context

Keep one job per retro pull request ever (A), or ask again when the earlier job has ended and a kept lesson still has no outcome (B).

## Decision

Before asking a runner to settle a retro pull request's lessons, the retro looks for any job already sent for that pull request, in any state, and sends none if one exists. Lessons added later, such as by the day-14 look, are settled by a person running the line the pull request shows.

The option chosen: A. One job per retro pull request, whatever its state (built)

## Consequences

B changes the lookup to ignore ended jobs: a few words in one query, and no stored shape.

## Source

`.omni-loop/delivery/shipped/2338-retro-apply/outbox/settled.md`, entry `s4-02-one-job-per-retro-pull-request`
