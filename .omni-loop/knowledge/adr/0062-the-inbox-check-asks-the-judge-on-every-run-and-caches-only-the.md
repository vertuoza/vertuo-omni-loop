# ADR-0062 — The inbox check asks the judge on every run and caches only the small model's verdict

**Status:** adopted · **Date:** 2026-10-01 · **PRD:** #871 · **Decided:** nobody — adopted when raised (medium), 2026-10-01 · **Merged:** @pierrederval, 2026-10-01, PR #874

## Context

Whether the judge's answer is cached with the small model's verdict.

## Decision

The inbox check caches the small model's verdict by repository, spec, claims and latest constituent change, but asks the judge on every evaluation. Switching Jev on or off takes effect at the next re-run, at the cost of one judge call per run.

The option chosen: A. A. Ask the judge every time; cache only the small model's verdict.

## Consequences

Adding the judge's answer to the cache is a few lines in the canon gate; the price is a mode switch that only counts after the spec or the lines change.

## Source

`.omni-loop/delivery/shipped/0871-product-constituents/outbox/settled.md`, entry `s5-01-judge-asked-on-every-check`
