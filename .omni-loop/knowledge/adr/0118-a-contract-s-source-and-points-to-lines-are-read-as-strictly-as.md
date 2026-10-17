# ADR-0118 — A contract's Source and Points to lines are read as strictly as a rule's, with a glob refused even in an imported copy

**Status:** adopted · **Date:** 2026-10-17 · **PRD:** #1796 · **Decided:** nobody — adopted when raised (medium), 2026-10-15 · **Merged:** @pierrederval, 2026-10-17, PR #1982

## Context

How a contract's Source: and Points to: lines are read: whether 'PRD <n>' without '#' leads somewhere, and whether the glob refusal is skipped in an imported copy as the existence check is.

## Decision

A contract's Source: must be 'PRD #<n>', an issue number or a path, as for rules. A glob in Points to: is refused everywhere, imported copies included, while file existence is checked only for this repository's own files.

The option chosen: A. Keep 'PRD #<n>' and refuse a glob everywhere, as built.

## Consequences

Two constants in kit/lib/knowledge/check-knowledge.ts; loosening either later breaks no entry.

## Source

`.omni-loop/delivery/shipped/1796-domain-contracts/outbox/settled.md`, entry `s1-02-contract-source-and-glob-strictness`
