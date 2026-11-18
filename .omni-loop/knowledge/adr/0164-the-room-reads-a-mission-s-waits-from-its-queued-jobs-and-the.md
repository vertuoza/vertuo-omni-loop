# ADR-0164 — The room reads a mission's waits from its queued jobs and the supervisor's own words, not from runner state

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2949 · **Decided:** nobody — adopted when raised (medium), 2026-11-16 · **Merged:** @pierrederval, 2026-11-16, PR #2950

## Context

How the room learns that a PRD waits for room, and which job it links. The line links the job that ran out for a limit, and the queued job for room.

## Decision

The room and the Missions tab learn a limit wait from the mission's queued jobs and the job a resume follows, and a wait for room from the supervisor's words about the mission, since the screen reads no runner state of its own.

The option chosen: A. Read the supervisor's words for the room wait (done)

## Consequences

Low: C replaces one parsing function (`waitsOf` in `limit-wait.ts`) and the read.

## Source

`.omni-loop/delivery/shipped/2949-limit-waits/outbox/settled.md`, entry `s5-01-room-says-waits-from-existing-reads`
