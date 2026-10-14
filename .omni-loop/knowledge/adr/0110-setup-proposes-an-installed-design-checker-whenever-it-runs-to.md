# ADR-0110 — Setup proposes an installed design checker whenever it runs to its report, even with findings

**Status:** adopted · **Date:** 2026-10-11 · **PRD:** #1369 · **Decided:** nobody — adopted when raised (medium), 2026-10-10 · **Merged:** @pierrederval, 2026-10-11, PR #1371

## Context

Whether a design checker with findings on today's screens is still suggested during setup.

## Decision

When setup finds a design checker installed, it proposes it as long as it runs and produces its report, whatever it finds, because the design review only reports and never blocks. A checker that cannot start becomes a question instead.

The option chosen: A. A. Suggest it whenever it runs to its report, findings or not, since the review never blocks

## Consequences

A one-line change in the setup skill's config table; no stored data moves.

## Source

`.omni-loop/delivery/shipped/1369-design-craft/outbox/settled.md`, entry `s5-01-design-lint-proposed-despite-findings`
