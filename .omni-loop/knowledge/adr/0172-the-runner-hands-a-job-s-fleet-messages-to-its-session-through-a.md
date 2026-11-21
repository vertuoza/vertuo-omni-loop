# ADR-0172 — The runner hands a job's fleet messages to its session through a file in the job's worktree

**Status:** adopted · **Date:** 2026-11-21 · **PRD:** #3107 · **Decided:** nobody — adopted when raised (medium), 2026-11-20 · **Merged:** @pierrederval, 2026-11-21, PR #3110

## Context

Add the claim's messages to the runner's job reading (kit/lib/runner/api.ts) and have the runner write them to .omni-loop/local/from-your-people.json in the job's worktree before the agent starts (kit/lib/runner/runner.ts).

## Decision

The runner writes the claim's fleet messages to .omni-loop/local/from-your-people.json in the job's worktree before the agent starts, and omni session start prints them from that file; no environment variable or app fetch is used.

The option chosen: A. A. The runner writes a file in the job's worktree, which omni session start reads (as built on the reading side).

## Consequences

Small: one field in the runner's job schema and one file write per job, with a test; nothing stored changes.

## Source

`.omni-loop/delivery/shipped/3107-fleet-commander/outbox/settled.md`, entry `s3-01-runner-hands-messages-to-the-session`
