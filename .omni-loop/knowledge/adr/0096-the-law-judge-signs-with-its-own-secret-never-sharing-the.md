# ADR-0096 — The law judge signs with its own secret, never sharing the constituent judge's

**Status:** adopted · **Date:** 2026-10-10 · **PRD:** #1342 · **Decided:** nobody — adopted when raised (medium), 2026-10-09 · **Merged:** @pierrederval, 2026-10-10, PR #1343

## Context

Whether the law judge signs with its own secret or shares the constituent judge's, and whether the slice may edit the app's settings list to add it.

## Decision

The law judge has its own optional secret, listed wherever the web app lists its secrets. While it is empty, every law judge call is refused and the classifier's own answer stands.

The option chosen: A. Its own secret, added to the app's settings list, its example file and its read-me list, the option built.

## Consequences

Removing the variable from four files and pointing the law judge at the other secret.

## Source

`.omni-loop/delivery/shipped/1342-laws-with-their-test/outbox/settled.md`, entry `s3-01-law-judge-own-secret`
