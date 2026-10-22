# ADR-0001 — A migration only adds: a column is never dropped in the release that stops reading it

**Status:** accepted · **Date:** 2026-10-01 · **PRD:** #9 · **Layers:** db

## Context

Two releases may run against one database while a deploy rolls out.

## Decision

A migration adds; a later one removes what nothing reads any more.

## Consequences

A rollback never meets a missing column.
