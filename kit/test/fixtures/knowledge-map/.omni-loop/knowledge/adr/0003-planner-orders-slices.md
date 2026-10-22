# ADR-0003 — The planner orders slices by their blockers, then by their wave

**Status:** accepted · **Date:** 2026-10-01 · **PRD:** #7

## Context

Two slices may be ready at once.

## Decision

The one with fewer blockers goes first.

## Consequences

A plan reads the same on every run.
