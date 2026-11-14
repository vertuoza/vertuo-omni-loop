# ADR-0141 — Every wake of a mission refreshes its job on the App's job ledger, and the job ends once nothing is left to watch

**Status:** adopted · **Date:** 2026-11-14 · **PRD:** #2842 · **Decided:** nobody — adopted when raised (medium), 2026-11-14 · **Merged:** @pierrederval, 2026-11-14, PR #2843

## Context

Whether every wake of a mission adds or requeues its job on the ledger (background_job_refresh, kind mission, key and lane mission:<id>, due at once), as built and as s5 must call it, or whether the mission's job should stay queued for ever so a bare background_job_wake is enough.

Decided by: Jev (hardToRevert 0.42) · agent said false

## Decision

A mission checks every minute while it runs or waits and its job ends when it is delivered, stopped, or paused with nothing running. Start, Resume, a job's end, a stage change and an answer all refresh its job so it is checked again at once.

The option chosen: A. Every wake refreshes the mission's job, which ends once there is nothing to watch (built).

## Consequences

A constant: if the job should never end, the handler returns later instead of done in two places, and s5 may then call background_job_wake alone. No stored shape changes.

## Source

`.omni-loop/delivery/shipped/2842-missions/outbox/settled.md`, entry `s4-01-start-and-wakes-refresh-the-mission`
