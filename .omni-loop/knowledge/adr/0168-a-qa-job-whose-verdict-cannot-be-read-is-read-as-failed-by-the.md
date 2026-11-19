# ADR-0168 — A QA job whose verdict cannot be read is read as failed by the mission, and its own job record is never rewritten

**Status:** adopted · **Date:** 2026-11-17 · **PRD:** #3001 · **Decided:** nobody — adopted when raised (medium), 2026-11-17 · **Merged:** @pierrederval, 2026-11-17, PR #3002

## Context

Spec section 4 and AC-6 say a QA job whose verdict line cannot be read, or names more than five bugs, ends `failed · verdict not read`. Taken in apps/omni-app/src/missions/qa.ts (withVerdicts), called by job.ts right after the store reads the runs: a QA job the runner reported done whose log tail reads no verdict of its own round is read, for that run, as failed with the reason `verdict not read`. The supervisor then sends a repair within PRD 2980's budget as for any failed step, and records `PRD <n>'s job failed: verdict not read.` signed qa. The runner_jobs row itself is not updated: it stays done as its runner reported it.

## Decision

When a QA job the runner reported done has no readable verdict of its round, the mission reads it as failed with 'verdict not read', records that in its history and sends a repair. The runner_jobs row keeps the ending its runner gave it.

The option chosen: A. Treat the job as failed only in the mission's reading and history; leave the job's own record as its runner gave it.

## Consequences

Writing the failure on the job's own row later is one update in the store, as the service role, and one test.

## Source

`.omni-loop/delivery/shipped/3001-qa-turn/outbox/settled.md`, entry `s4-02-verdict-not-read-is-read-as-failed`
