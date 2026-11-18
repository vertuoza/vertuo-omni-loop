# ADR-0169 — A slice that changes a migration commits the regenerated database types with it, even outside its declared territory

**Status:** adopted · **Date:** 2026-11-18 · **PRD:** #3007 · **Decided:** nobody — adopted when raised (medium), 2026-11-17 · **Merged:** @pierrederval, 2026-11-18, PR #3008

## Context

Whether the regenerated database types ride with this slice, or a later step of the wave regenerates them.

## Decision

A slice that adds or changes a database migration carries supabase/database.types.ts exactly as the generator writes it from a fresh database, even when the plan does not list the file, because pushes and database checks refuse a migration without it.

The option chosen: A. As built: the slice carries the regenerated file with its migration.

## Consequences

None to undo: the file is regenerated from the migrations whenever they change.

## Source

`.omni-loop/delivery/shipped/3007-kit-knowledge-mcp/outbox/settled.md`, entry `s1-03-database-types-outside-territory`
