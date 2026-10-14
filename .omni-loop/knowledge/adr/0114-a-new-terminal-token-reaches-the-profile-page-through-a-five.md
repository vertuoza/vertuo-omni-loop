# ADR-0114 — A new terminal token reaches the profile page through a five-minute, read-once hand-back kept for that browser where no script can read it

**Status:** adopted · **Date:** 2026-10-12 · **PRD:** #1628 · **Decided:** nobody — adopted when raised (medium), 2026-10-11 · **Merged:** @pierrederval, 2026-10-12, PR #1629

## Context

Keep the five-minute, read-once hand-back for the profile page, or choose another way to show the token once.

## Decision

The sign-in keeps a new token for the asking browser for five minutes, out of reach of page scripts, and the profile page reads it once on its return. The terminal receives its token on its own computer, as sign-in codes do.

The option chosen: A. A. Kept five minutes for that browser, read once by the profile page; the terminal gets it on its own computer (built)

## Consequences

Contained in galaxy's sign-in and one route; the two slices that read it follow whatever is chosen.

## Source

`.omni-loop/delivery/shipped/1628-cloud-sign-in/outbox/settled.md`, entry `s1-06-token-hand-back`
