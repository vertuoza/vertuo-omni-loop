---
id: s1-01-phase0-flag-database-check
prd: 1299
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Should the rule that only the workspace owner can switch where phase 0 is approved also be proven by the automatic database check that runs on every pull request?

## The decision, in plain words

The rule lives in the database and is covered by tests of the page and the route, but no database check proves it yet, because this slice was only allowed to touch the migration, the types and the galaxy files.

## The intro, for fun

A lock on the door, and nobody has rattled the handle yet.

## The punchline, for fun

The tests trust the lock; the database check would try it.

## The options, in plain words

A. Ship the flag without a database check of its own; the migration mirrors the tracked switch, which is already checked.
B. Add the owner-only, default-pr and unknown-repository cases to the repositories database check in a follow-up slice.

## What I had to decide

Whether a follow-up adds the owner-only and default-pr cases for the new flag to the repositories database check.

## What I did meanwhile

The migration refuses anyone but the owner exactly as the tracked switch does; the galaxy tests cover the refusal as the page and the route read it, against a stubbed database.

## What it costs to change later

Adding the check later is one small change to the database checks file, with no migration and no data change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No run of the migration against a local database in this slice: the supabase workflow applies it in CI (author)
