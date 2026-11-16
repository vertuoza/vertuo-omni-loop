# ADR-0154 — omni ready reads mission membership from the repository's own mission records, not the Omni page

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2898 · **Decided:** nobody — adopted when raised (medium), 2026-11-15 · **Merged:** @pierrederval, 2026-11-16, PR #2902

## Context

Print `ready.checks` and whether a mission record of this repository names the PRD, as one line, and leave the verdict to the five checks. The gate that calls omni ready decides whom to ask.

## Decision

omni ready says whether one of the repository's own mission records names the PRD, printed beside the verdict. It cannot tell running from paused or finished, and the answer never changes the five checks.

The option chosen: A. A. Read the mission records of the repository and print the answer beside the verdict (built).

## Consequences

A small page call later, if the state must be read: one function in kit/lib/mission/membership.ts.

## Source

`.omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md`, entry `s3-01-ready-mission-from-records`
