# ADR-0138 — The multi-repository review watcher reads and reports the hold but never marks a pull request ready

**Status:** adopted · **Date:** 2026-11-13 · **PRD:** #2746 · **Decided:** nobody — adopted when raised (medium), 2026-11-13 · **Merged:** @pierrederval, 2026-11-13, PR #2747

## Context

Whether the watcher keeps its rule of never marking ready, or gains the right to mark a pull request ready once its provider is served.

## Decision

Each round, mega-pr-care reads the hold and writes what each held pull request waits for on its status comment, and it still never marks anything ready. The skills that do mark ready check the hold again first.

The option chosen: A. A. The watcher reads and reports the hold each round and never marks ready.

## Consequences

Letting the watcher mark ready later is a few lines in one skill and the guardrail it lifts.

## Source

`.omni-loop/delivery/shipped/2746-hold-consumer/outbox/settled.md`, entry `s3-02-mega-pr-care-reads-hold`
