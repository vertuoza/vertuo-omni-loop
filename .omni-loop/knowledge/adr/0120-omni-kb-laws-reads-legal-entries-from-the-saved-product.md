# ADR-0120 — omni kb laws reads Legal entries from the saved product knowledge copy, never the Omni page

**Status:** adopted · **Date:** 2026-10-22 · **PRD:** #2346 · **Decided:** nobody — adopted when raised (medium), 2026-10-22 · **Merged:** @pierrederval, 2026-10-22, PR #2348

## Context

Where omni kb laws --paths and --slice read the Legal entries from: the local copy every session start refreshes, or the Omni page on each call; and what it says when there is no copy.

Decided by: Jev (hardToRevert 0.46) · agent said false

## Decision

omni kb laws --paths and --slice read Legal entries only from the product knowledge copy under .omni-loop/local/ that session start and omni kb legal write, making no network call. With no readable copy, it lists no Legal entry and prints nothing about it.

The option chosen: A. Read the saved copy, with no network call, and say nothing when there is none (built).

## Consequences

A line in the command: read the page through the same call omni kb legal makes, or print one line when the copy is missing.

## Source

`.omni-loop/delivery/shipped/2346-knowledge-by-domain-and-layer/outbox/settled.md`, entry `s3-03-legal-from-local-copy`
