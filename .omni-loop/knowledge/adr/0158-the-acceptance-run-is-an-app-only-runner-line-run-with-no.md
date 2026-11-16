# ADR-0158 — The acceptance run is an App-only runner line run with no assistant session, not a skill a person sends

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2898 · **Decided:** nobody — adopted when raised (medium), 2026-11-15 · **Merged:** @pierrederval, 2026-11-16, PR #2902

## Context

Pick A to keep the line the App's own, or B to make it a skill a person sends too.

## Decision

When screen tests cannot run in the continuous checks, the Omni App sends a runner the line /omni:acceptance; the runner runs the tests itself with no assistant session, and the Send box refuses the line, so the person-sent skill list is unchanged.

The option chosen: A. A. A line only the App sends, run by the runner with no assistant: what was built.

## Consequences

Making it a skill later is a plugin skill folder, its help entry, the name in `RUNNABLE_SKILLS` and `RUNNER_SKILLS`, the Runners guide's list and a migration of the fixed list; the runner's code stays.

## Source

`.omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md`, entry `s8-01-acceptance-line-runs-no-agent`
