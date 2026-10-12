# ADR-0087 — The roadmap skills prove their review pull request by running omni phase0 once per PRD, allowing only a missing plan

**Status:** adopted · **Date:** 2026-10-07 · **PRD:** #1162 · **Decided:** nobody — adopted when raised (medium), 2026-10-07 · **Merged:** @pierrederval, 2026-10-07, PR #1163

## Context

Whether the skill proves the phase-0 PR by running omni phase0 per PRD and allowing only missing: plan (built), or whether omni phase0 should learn a roadmap mode first.

## Decision

/omni:roadmap and /omni:mega-roadmap prove their review pull request by running omni phase0 once for each PRD. Only a missing plan is accepted as a fault; documents only, signed, and spec and before/after page present must hold for every PRD.

The option chosen: A. A. Run the check once per project and allow only the missing plan (built)

## Consequences

Teaching omni phase0 a --roadmap <n> mode later is one kit change and one line in each skill's step 5.

## Source

`.omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md`, entry `s9-02-roadmap-phase0-proved-per-prd`
