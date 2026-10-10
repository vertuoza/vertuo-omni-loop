# ADR-0099 — The enforce sweep removes a not-worth-a-law entry with no ledger source, naming it in its report as recorded in no ledger

**Status:** adopted · **Date:** 2026-10-10 · **PRD:** #1342 · **Decided:** nobody — adopted when raised (medium), 2026-10-10 · **Merged:** @pierrederval, 2026-10-10, PR #1343

## Context

What a not-worth-a-law entry with no ledger entry in its Source becomes.

## Decision

When the sweep judges a register entry not worth a law and its Source names no ledger decision, the entry still leaves its register. The sweep's report names it as recorded in no ledger and lists its citations, so the reviewer sees it before merging.

The option chosen: A. A. Remove it anyway, naming it in the report as recorded nowhere.

## Consequences

One branch: keeping the entry instead, or writing a note somewhere else, is a few lines in the sweep's pure module.

## Source

`.omni-loop/delivery/shipped/1342-laws-with-their-test/outbox/settled.md`, entry `s6-02-no-ledger-rule-leaves-anyway`
