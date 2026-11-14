# ADR-0124 — Database checks share one made-up Initech workspace with its own GitHub organisation

**Status:** adopted · **Date:** 2026-10-21 · **PRD:** #2305 · **Decided:** nobody — adopted when raised (medium), 2026-10-21 · **Merged:** @pierrederval, 2026-10-21, PR #2307

## Context

Whether the checks' fixture workspace is Initech (organisation initech), shared through supabase/checks/fixtures/initech.sql that each check includes after its begin, or whether it should be renamed or inlined.

## Decision

Every database check that needs a workspace includes the shared fixture supabase/checks/fixtures/initech.sql after its begin. Initech has its own organisation, initech, never demo-org, because two workspaces of one organisation would let the checks read the demo world's data.

The option chosen: A. One shared fixture, Initech with organisation initech, included by each check (built).

## Consequences

Renaming the fixture is a find-and-replace over supabase/checks; inlining it copies about forty lines into each of thirty-three checks. No migration, no production data.

## Source

`.omni-loop/delivery/shipped/2305-open-source-safe/outbox/settled.md`, entry `s6-01-checks-own-workspace-initech`
