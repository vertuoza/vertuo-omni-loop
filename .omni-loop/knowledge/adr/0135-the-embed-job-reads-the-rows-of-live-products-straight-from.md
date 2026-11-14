# ADR-0135 — The embed job reads the rows of live products straight from their tables, skipping archived products and legal owners

**Status:** adopted · **Date:** 2026-11-12 · **PRD:** #2728 · **Decided:** nobody — adopted when raised (medium), 2026-11-12 · **Merged:** @pierrederval, 2026-11-12, PR #2730

## Context

Whether archived products are skipped (as built) and whether the job reads the product's rows directly, as the MCP reads its never lines, rather than through one database function.

## Decision

To prepare legal entries, terms and never lines for meaning search, the background job reads them directly from the product tables for every non-archived product holding the repository, as the MCP reads never lines, and leaves out each legal entry's owner.

The option chosen: A. A. Read the rows of live products straight from their tables, with no owner (built).

## Consequences

Including archived products is one filter removed; reading through a database function is one new function and a swap of the store's reads.

## Source

`.omni-loop/delivery/shipped/2728-mcp-meaning-search/outbox/settled.md`, entry `s4-02-embed-job-reads-live-products-rows-directly`
