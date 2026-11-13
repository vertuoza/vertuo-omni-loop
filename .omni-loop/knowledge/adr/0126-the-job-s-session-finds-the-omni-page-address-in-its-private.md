# ADR-0126 — The job's session finds the Omni page address in its private token file, not in its environment

**Status:** adopted · **Date:** 2026-10-23 · **PRD:** #2433 · **Decided:** nobody — adopted when raised (medium), 2026-10-22 · **Merged:** @nicojustdev, 2026-10-23, PR #2434

## Context

Whoever owns the runner. The address is saved next to the token by the function that saves a job's token (github-token.ts), and read back by omni runner github-token; moving it to another place is a change in those two spots and in runner.ts where the job starts.

Decided by: Jev (hardToRevert 0.46) · agent said false

## Decision

The runner writes the Omni page address into the job's private token file when the job starts, and omni runner github-token reads it from there to refresh. A file without the address fails the refresh rather than guessing.

The option chosen: A. A. Keep the page address in the job's private token file, written when the job starts, so the session needs nothing else.

## Consequences

Small. A different home for the address (an environment variable, or the checkout's configuration) is a constant and two reads; no migration, and old token files simply have no page field.

## Source

`.omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md`, entry `s3-01-the-session-finds-the-page-in-the-token-file`
