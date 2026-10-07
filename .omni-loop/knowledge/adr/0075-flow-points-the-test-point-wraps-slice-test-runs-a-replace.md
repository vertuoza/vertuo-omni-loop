# ADR-0075 — Flow points: the test point wraps slice test runs, a replace opener opens main PRs only, and a refused merge waits for the next run

**Status:** adopted · **Date:** 2026-10-06 · **PRD:** #1089 · **Decided:** nobody — adopted when raised (medium), 2026-10-06 · **Merged:** @pierrederval, 2026-10-06, PR #1090

## Context

Whether the test point should also be able to replace the full check that runs before a slice ships, whether a replacement opener should open the small slice pull requests too, and whether a refused merge should wait quietly or be marked as stuck.

## Decision

The test point wraps only the slice's own test runs, and the preflight and merge gate stay guards. A replacement opener opens feature and standalone PRs only, never sub-PRs. A sub-PR the merge check refuses stays open, unlabelled, and is retried next run.

The option chosen: A. Keep it: the test point wraps the slice's test runs, the preflight and the merge gate are guards, a replace opener skips sub-PRs, and a refused merge waits unlabelled for the next run.

## Consequences

Small: a few sentences in kit/plugin/skills/do-work, pr and wave, and the regexes in kit/test/flow-points.test.ts; no stored data moves.

## Source

`.omni-loop/delivery/shipped/1089-repo-flow/outbox/settled.md`, entry `s7-01-skill-points-placement`
