# ADR-0034 — The retro function runs one retro at a time per repository, not per repository and PRD

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #72 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #75

## Context

The retro function's concurrency key. The spec ("Flow") gives it "its own concurrency key (repository + PRD)", but the event carries only the repository and the pull request number (the spec's own event shape); the PRD is known after the step "qualify" reads the config and the delivery folder at the merge SHA, and a concurrency key is read from the event before the run starts.

## Decision

The retro's concurrency key is the repository alone, limit 1, because the PRD is only known after the run starts reading at the merge SHA. This keeps two retros of one request apart, and merges are rare enough that waiting costs little.

The option chosen: A. One retro at a time per repository, the option built.

## Consequences

One constant. Keying on the repository and the feature branch's name instead would need the head ref added to the event the webhook sends, one more field and its test.

## Source

`.omni-loop/delivery/shipped/0072-retro/outbox/settled.md`, entry `s2-02-one-retro-at-a-time-per-repository`
