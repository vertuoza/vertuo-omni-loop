# ADR-0015 — The outbox check grades changed files for unaccounted risky changes only when the list is handed in

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #28 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #29

## Context

The spec makes changed files an input to evaluate, and the kit's gate uses them for one thing only, the unaccounted-risky-change reason. But the spec's conclusion table names only open items and unreworked drift, and the gate as /omni:yolo runs it today does not grade the range.

## Decision

When given a pull request's changed files, the outbox check holds it for unaccounted risky changes, as the kit's full gate does, and names them in its title. Without the list, it looks only at open items and unreworked drift.

The option chosen: A. Grade the changed files whenever they are handed in, as built.

## Consequences

One argument: s5 passes the changed files or does not. No stored data depends on it.

## Source

`.omni-loop/delivery/shipped/0028-omni-app-outbox-check/outbox/settled.md`, entry `s1-02-evaluate-grades-changed-files-when-given`
