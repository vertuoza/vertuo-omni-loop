---
id: s1-01-keys-live-in-agent-links
prd: 2425
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

The plan says the new key columns point at a table of API keys, but no such table exists: keys are stored with the agent links. Should the columns point at the agent links table instead?

## The decision, in plain words

The new columns point at the agent links table, the one that already holds every API key, because no separate key table exists. Nothing else in the design changes.

## The intro, for fun

A plan named a table that was never built.

## The punchline, for fun

The keys had been living next door all along.

## The options, in plain words

A. Point the new columns at the agent links table, which holds every key today.
B. Build a separate keys table first and point the columns at it: one more migration, and every existing key would have to move.

## What I had to decide

PRD 2425's plan says `cancelled_by_key` and `closed_by_key` reference `api_keys`. There is no such table: PRD 2022 stores an API key as an `agent_tokens` row of scope `api` (20261210090000_api_keys.sql), and `runner_jobs.sent_by_key` already references `agent_tokens (id)`. Both new columns follow it, `on delete set null`, so a deleted key leaves what it did in place.

## What I did meanwhile

Built both foreign keys on `agent_tokens (id)`, `on delete set null` as `sent_by_key` does, and proved in supabase/checks/api_key_jobs.sql that deleting a key leaves the job and the round as they were.

## What it costs to change later

Pointing them somewhere else later is one migration that drops and re-adds two constraints; no row changes, since the ids stay the same.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant a separate keys table to come later: none is planned in PRD 2022's migration.
