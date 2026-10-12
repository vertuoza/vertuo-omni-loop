# ADR-0085 — A stored roadmap keeps its open questions with answers, each waiting PRD's waits-on line and link, and six PRD states including closed

**Status:** adopted · **Date:** 2026-10-07 · **PRD:** #1162 · **Decided:** nobody — adopted when raised (medium), 2026-10-07 · **Merged:** @pierrederval, 2026-10-07, PR #1163

## Context

Whether the stored roadmap carries its questions and answers, and whether `closed` is a state of its own.

## Decision

The stored roadmap carries its open questions with any answer given. Each waiting PRD keeps one line naming what it waits on plus a link, and a PRD's state is one of waiting, building, outbox, ready for a merge, merged or closed.

The option chosen: A. A. Store the questions with their answers on the roadmap, waits-on as a line and a link, and six states including closed (built).

## Consequences

Changing it later is one migration on two tables nothing else reads, and the matching edits in the API's schema, s5's page and s6's push.

## Source

`.omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md`, entry `s2-01-roadmap-push-shape`
