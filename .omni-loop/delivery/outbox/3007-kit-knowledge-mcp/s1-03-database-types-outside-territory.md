---
id: s1-03-database-types-outside-territory
prd: 3007
slice: s1
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The new database change also changes the generated description of the database, a file this slice's plan did not list. May the slice carry it?

## The decision, in plain words

The slice carries the regenerated file, exactly as the generator wrote it, because every push and every database check refuses a database change without it.

## The intro, for fun

A map that does not show the new road gets a traveller lost.

## The punchline, for fun

So the map came along, drawn by the machine, not by hand.

## The options, in plain words

A. As built: the slice carries the regenerated file with its migration.
B. Leave it out of the slice, and have the wave regenerate it once after merging, accepting a red database check on the slice until then.

## What I had to decide

Whether the regenerated database types ride with this slice, or a later step of the wave regenerates them.

## What I did meanwhile

The slice commits supabase/database.types.ts as node scripts/supabase-types.ts wrote it from a fresh local database with every migration applied: seven added lines (the log's new column, the new function), nothing else. The conventions form asks for it on every migration change, and the pre-push hook and the supabase workflow check it. No other slice of the plan touches the file.

## What it costs to change later

None to undo: the file is regenerated from the migrations whenever they change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names the migrations folder but not the generated types file the conventions require beside every migration.
