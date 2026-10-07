# ADR-0077 — omni pitch start runs the four refusals, reads the product's look and opens the run folder; an unreadable look falls back to arcade with a one-line note

**Status:** adopted · **Date:** 2026-10-06 · **PRD:** #859 · **Decided:** nobody — adopted when raised (medium), 2026-10-01 · **Merged:** @pierrederval, 2026-10-06, PR #860

## Context

Keep omni pitch start (refusals, look, run folder) and the arcade fallback, or fold the refusals into each verb and stop when the look cannot be read.

## Decision

A separate omni pitch start command checks the four refusals, reads the product's look from the Omni page and opens the run's folder with pitch.json. When the look cannot be read, the pitch continues in the arcade look and says so in one line.

The option chosen: A. A start command for the refusals, the look and the run folder; an unreadable look falls back to arcade (built).

## Consequences

Folding the refusals into the other verbs later is moving one function call; removing the fallback is one line. Nothing stored changes.

## Source

`.omni-loop/delivery/shipped/0859-pitch/outbox/settled.md`, entry `s4-01-start-verb-and-look`
