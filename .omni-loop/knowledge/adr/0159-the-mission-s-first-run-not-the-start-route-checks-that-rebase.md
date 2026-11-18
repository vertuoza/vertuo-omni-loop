# ADR-0159 — The mission's first run, not the Start route, checks that rebase merges are allowed and cuts the mission branch

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2896 · **Decided:** nobody — adopted when raised (medium), 2026-11-15 · **Merged:** @pierrederval, 2026-11-16, PR #2897

## Context

Whether Start itself, in the page's route, should also refuse on the setting.

## Decision

The mission's first run after Start checks the repository's rebase-merge setting and cuts the branch once from the default branch. With rebase merges off it cuts nothing, sends no PRD, and the mission waits naming the setting.

The option chosen: A. A. The mission's first run cuts the branch and checks the setting; the mission waits naming it (built).

## Consequences

Refusing in the route as well costs one call to GitHub in the Start route and one test; the run's check can stay as the second guard.

## Source

`.omni-loop/delivery/shipped/2896-fleet-alone/outbox/settled.md`, entry `s3-02-branch-cut-by-the-first-run`
