# ADR-0049 — The history filters and searches only the newest thousand questions, in the app

**Status:** adopted · **Date:** 2026-09-27 · **PRD:** #144 · **Decided:** nobody — adopted when raised (medium), 2026-09-26 · **Merged:** @pierrederval, 2026-09-27, PR #147

## Context

Whether the history should look back only over the newest thousand questions, or search every question the database holds.

## Decision

The history page reads the newest 1000 rounds the caller may see and applies every filter and search in the app. Older questions stay kept and open by link, but a filter or search will not find them.

The option chosen: A. Read the newest thousand questions and filter and search within them

## Consequences

Raising the number is a one-line change. Searching everything means moving the filters and the search into the database (a view or a function with a text index), a migration and a new read, with the page unchanged.

## Source

`.omni-loop/delivery/shipped/0144-question-history/outbox/settled.md`, entry `s5-01-history-reads-newest-thousand`
