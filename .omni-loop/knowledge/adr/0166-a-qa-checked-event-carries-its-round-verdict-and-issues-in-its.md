# ADR-0166 — A QA checked event carries its round, verdict and issues in its sentence and link, not in columns of its own

**Status:** adopted · **Date:** 2026-11-17 · **PRD:** #3001 · **Decided:** nobody — adopted when raised (medium), 2026-11-17 · **Merged:** @pierrederval, 2026-11-17, PR #3002

## Context

Two choices in supabase/migrations/20270125160000_qa_turn.sql. First, runner_jobs_mission_key_shape now takes :qa:<1|2> and :qa-fix:1:<1-5> after a run's key: the plan gives the job keys to s4 (apps/omni-app/src/missions/), but only s2 adds a migration, and without it s4's inserts would be refused. Second, a `checked` event adds no column: its round, verdict and bugs' issues ride in its sentence and its link, as a `reviewed` event carries the Reviewer's, so the database does not refuse a `checked` event with no round; the spec's test seam asked that a checked event need a verdict and a round.

## Decision

A mission's checked event records QA's round, verdict and bugs' issues in its sentence and link, as a reviewed event carries the Reviewer's, with no added columns. The runner job key accepts the QA round and QA fix keys after a run's key.

The option chosen: A. Widen the job key now, and keep QA's verdict in the event's sentence as the Reviewer's is.

## Consequences

Widening or narrowing one check constraint, or adding nullable columns later, in one follow-up migration.

## Source

`.omni-loop/delivery/shipped/3001-qa-turn/outbox/settled.md`, entry `s2-03-qa-keys-and-checked-event`
