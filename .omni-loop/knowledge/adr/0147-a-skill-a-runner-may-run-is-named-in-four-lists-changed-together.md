# ADR-0147 — A skill a runner may run is named in four lists, changed together

**Status:** accepted · **Date:** 2026-11-19 · **PRD:** #3065 · **Decided:** @pierrederval via feature pull request #3066, 2026-11-18

## Context

PRD 3065 added `/omni:mission-retro`, a skill a mission sends to a runner. A runner takes only a
line naming a skill the kit, the App and the database all allow, so the slice that added the skill
had to touch lists outside its own folders.

## Decision

A skill a runner may run is named in four lists, changed in the same change:

- the kit's runnable list (`kit/lib/runner/line`);
- the App's contract list;
- the runners guide;
- the fixed list of `set_repository_runner_skill`, through a new migration.

Missing one, the App or the database refuses the line, and the skill never runs on a runner.

## Consequences

A slice adding a runner skill lists `supabase/migrations/` and the App's contract in its territory.
The Engineer role (`kit/lib/virtual-fleet/roles.ts`) is a separate choice: adding a skill there moves
the heroes drawer's counts.

## Source

`.omni-loop/delivery/shipped/3065-mission-retros/outbox/settled.md`, entry `s3-01-mission-retro-runner-lists`.
