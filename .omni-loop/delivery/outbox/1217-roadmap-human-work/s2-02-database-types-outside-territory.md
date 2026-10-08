---
id: s2-02-database-types-outside-territory
prd: 1217
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

The new table changes the list of database types the app keeps beside its migrations, a file the plan did not give this slice. Should the slice refresh it?

## The decision, in plain words

The slice refreshed that list from the new migration, because the database check fails on any pull request where the list and the migrations disagree.

## The intro, for fun

A new table walked in, and the guest list at the door had to learn its name.

## The punchline, for fun

Nobody wants a bouncer turning away the table it was built for.

## The options, in plain words

A. Refresh the list in the slice that adds the migration, as done.
B. Leave the list alone in the slice and refresh it in a follow-up, letting the database check fail until then.
C. Add the list to the plan's territory for every slice that adds a migration, from the next plan on.

## What I had to decide

Whether the generated database types may be refreshed by the slice that adds a migration, though the plan left them out of its territory.

## What I did meanwhile

supabase/database.types.ts is regenerated with `node scripts/supabase-types.ts` against a local database with the new migration applied: only the roadmap_human_work table is added.

## What it costs to change later

A constant: the file is generated, so any other answer is a regeneration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the list should become a generated entry of the config, rebuilt by the wave like the kit bundle (author)
