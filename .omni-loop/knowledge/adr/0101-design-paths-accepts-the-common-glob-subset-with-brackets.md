# ADR-0101 — design.paths accepts the common glob subset, with brackets literal and a bare name as a folder

**Status:** adopted · **Date:** 2026-10-11 · **PRD:** #1369 · **Decided:** nobody — adopted when raised (medium), 2026-10-10 · **Merged:** @pierrederval, 2026-10-11, PR #1371

## Context

Whether design.paths needs character classes or negation, or the common subset is enough.

## Decision

design.paths patterns accept *, **, ? and {a,b}. A pattern ending in / or holding no wildcard matches everything under that folder, and [ and ] are literal, so bracket-named folders match as written.

The option chosen: A. A. The common subset, brackets literal, a bare name as a folder (built)

## Consequences

A constant: a wider syntax is an added branch in kit/lib/design/glob.ts; no stored data changes.

## Source

`.omni-loop/delivery/shipped/1369-design-craft/outbox/settled.md`, entry `s2-02-design-paths-glob-syntax`
