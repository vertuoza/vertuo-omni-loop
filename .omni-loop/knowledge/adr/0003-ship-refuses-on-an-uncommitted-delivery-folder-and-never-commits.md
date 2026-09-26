# ADR-0003 — Ship refuses on an uncommitted delivery folder and never commits the move itself

**Status:** accepted · **Date:** 2026-09-25 · **PRD:** #3 · **Decided:** @claude-code-session (delegated by pierre-derval) via PRD issue #3, 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #4

## Context

What `omni ship` does on a dirty `paths.delivery`, and whether it commits.

## Decision

`omni ship` refuses to run while `paths.delivery` has uncommitted changes and only stages the move and rewrites; a person reviews and commits it.

The option chosen: A. Refuse until the delivery folder is committed, and leave the move for a person to commit, the option built.

## Consequences

Small: the refusal is one check in `kit/lib/delivery/ship.mjs`; committing would add a commit author and message convention the kit does not have yet.

## Source

`.omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md`, entry `s14-01-ship-needs-committed-tree`
