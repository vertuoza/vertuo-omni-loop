# ADR-0170 — The Missions tab's answer to a budget stop records the person's row and wakes the paused missions; the supervisor acts at each mission's next check

**Status:** adopted · **Date:** 2026-11-18 · **PRD:** #3040 · **Decided:** nobody — adopted when raised (medium), 2026-11-18 · **Merged:** @pierrederval, 2026-11-18, PR #3042

## Context

Keep A, so the Missions tab's answer records the person's row and wakes every mission of the stop, or pick another part to do it.

## Decision

The Missions tab's answer records the person's answer row and wakes every mission of the stop, or for a fleet's stop every paused mission of the fleet. The supervisor then resumes, sleeps until tomorrow or stops at each mission's next check, and says so in the room.

The option chosen: A. A. The Missions tab's answer records the person's row and wakes every mission of the stop, and for a fleet's stop every paused mission of the fleet; the supervisor acts on it (built).

## Consequences

Low: waking from the answer is one call per mission in the answer's route, as Resume makes today.

## Source

`.omni-loop/delivery/shipped/3040-token-budget/outbox/settled.md`, entry `s3-01-budget-answer-wakes-the-missions`
