# ADR-0163 — A mission in a plan repository is refused own-branch by the app's checks, not by a database rule

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2896 · **Decided:** nobody — adopted when raised (medium), 2026-11-16 · **Merged:** @pierrederval, 2026-11-16, PR #2897

## Context

Whether to add a migration. A plan repository is a product setting that can change after a mission is made, so a database rule would be stale anyway.

## Decision

A mission in a plan repository is refused the own-branch level by the app: the Missions tab does not offer it, and the level call, Start and the run refuse it with one line. No database rule checks it, because a product's plan repository can change after the mission is made.

The option chosen: A. Refuse in the app: the tab, the level call, Start and the run (built).

## Consequences

Adding a database rule later is one migration; the app's checks can stay.

## Source

`.omni-loop/delivery/shipped/2896-fleet-alone/outbox/settled.md`, entry `s14-01-own-branch-refused-in-the-app-not-the-database`
