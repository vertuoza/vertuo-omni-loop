# ADR-0061 — The prd_outbox table keeps each PRD's waiting questions beside its count, so the waiting list never asks GitHub

**Status:** adopted · **Date:** 2026-09-29 · **PRD:** #657 · **Decided:** nobody — adopted when raised (medium), 2026-09-29 · **Merged:** @pierrederval, 2026-09-29, PR #664

## Context

Whether prd_outbox keeps the waiting questions (rank, id and words of each human-action or high item while the feature PR is open) in a list column beside open_questions, as built, or whether the waiting outbox keeps reading GitHub for its question words.

## Decision

prd_outbox stores, beside open_questions, a checked list of the questions waiting on a person (rank, id, words), filled by the same recount from the GitHub summary. GET /api/waiting/outbox builds its items from it with no GitHub call.

The option chosen: A. Keep the waiting questions beside each count in the new table, filled by the same recount (built).

## Consequences

The table is new in this PRD, so before it ships dropping or changing the column is an edit of its migration; after it ships, one follow-up migration drops the column, and the waiting route goes back to the GitHub reader.

## Source

`.omni-loop/delivery/shipped/0657-snappy-pages/outbox/settled.md`, entry `s5-01-waiting-questions-stored`
