# ADR-0060 — The canon check remembers verdicts in the running App's memory only, lost on a cold start

**Status:** adopted · **Date:** 2026-09-30 · **PRD:** #839 · **Decided:** nobody — adopted when raised (medium), 2026-09-30 · **Merged:** @pierrederval, 2026-09-30, PR #840

## Context

Whether a verdict must be remembered across restarts of the App, which needs a new stored table, or whether remembering it while the App is warm is enough.

## Decision

The canon check keeps its verdicts in the warm App's memory, keyed by repository, spec fingerprint and the claims' latest change, up to 200 verdicts. A re-run soon after costs nothing; after a cold start the first run asks the model again.

The option chosen: A. A. Remember verdicts in the running App only, lost on a cold start.

## Consequences

Moving it to a stored table is a small migration and a new read and write in the canon module; nothing already stored moves.

## Source

`.omni-loop/delivery/shipped/0839-canon-check/outbox/settled.md`, entry `s3-01-canon-cache-in-instance`
