# ADR-0037 — Failed-run log tails travel on each evidence link of the retro fact sheet

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #72 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #75

## Context

Where the failed jobs' log tails live in the fact sheet, so that `narrate` (slice s6, built at the same time) can send them. `narrate` receives only `{ sheet, prd }` (its contract in `apps/omni-app/src/retro/narrate.mjs`); the spec says the model gets "per finding its id, its facts and its evidence excerpts (failed-job log tails of about 200 lines…)"; the registry in `kinds/index.mjs` types evidence as `{ label, url }`.

## Decision

Each evidence link to a failed run carries that run's last log lines as an excerpt, so narrate gets them with the finding they explain. retro.md renders only the links, while retro.json keeps the excerpts.

The option chosen: A. Each link to a failed run carries its last lines, the option built.

## Consequences

A few lines in `kinds/ci.mjs` and its tests if `narrate` looks elsewhere. Before any retro is merged, nothing else; after, the `retro.json` files already merged keep the excerpts where they are.

## Source

`.omni-loop/delivery/shipped/0072-retro/outbox/settled.md`, entry `s3-02-log-lines-travel-with-evidence`
