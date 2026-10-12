# ADR-0094 — Concept state is read from GitHub through the shared dossier GitHub reader, with its own short cache

**Status:** adopted · **Date:** 2026-10-09 · **PRD:** #1272 · **Decided:** nobody — adopted when raised (medium), 2026-10-08 · **Merged:** @pierrederval, 2026-10-09, PR #1282

## Context

Whether the concept's GitHub read goes in the shared GitHub reader (outside this slice's ground), or in a reader of its own inside it.

Decided by: Jev (hardToRevert 0.48) · agent said false

## Decision

The galaxy app reads a concept's GitHub state through the same reader that reads fixes (reader.ts), with its own 60-second cache, so the token, installation and repository config stay in one place and no second GitHub connection exists.

The option chosen: A. A. Ask GitHub about a concept through the part that already asks about fixes, as built.

## Consequences

Moving the read later is one method and its test moved to another file; nothing is stored differently and no migration is involved.

## Source

`.omni-loop/delivery/shipped/1272-concepts-page/outbox/settled.md`, entry `s4-01-concept-read-in-the-shared-reader`
