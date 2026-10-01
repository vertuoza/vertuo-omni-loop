---
id: s1-01-migration-version
prd: 902
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The plan named a date for the new database change that another change already uses, so the database would refuse to apply both. Which date should it carry?

## The decision, in plain words

I gave the new database change the next free date, a day after the latest one, so both apply in order.

## The intro, for fun

Two database changes walked in holding the same ticket number.

## The punchline, for fun

One of them politely took the next ticket instead.

## The options, in plain words

A. Keep 20261030090000, the next free version.
B. Pick another free version the reviewer prefers.

## What I had to decide

The plan's territory names `supabase/migrations/20261028090000_github_budget*`, but `20261028090000_agent_tokens.sql` already holds that version, and Supabase keys applied migrations by version. s2's planned `20261029090000_dossier_github*` collides with `20261029090000_constituents.sql` the same way.

## What I did meanwhile

Named the migration `supabase/migrations/20261030090000_github_budget.sql`, the first version after the latest one on the feature branch. It applies cleanly after every other migration on a local `supabase db start`.

## What it costs to change later

A rename of one file before it merges; after it reaches production, a new migration, never a rename. s2 should pick its own free version too (for example 20261031090000).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan's version was meant to sort before s2's on purpose (author): the new name keeps that order only if s2 picks a later one.
