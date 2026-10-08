---
id: s5-02-database-types-by-hand
prd: 1218
slice: s5
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

The app's list of database tables had to learn the new prerequisites table, but that file was not in this step's planned area. Was it right to update it here?

## The decision, in plain words

The list was updated here, by hand, in the exact form the generator writes, so the app builds. The database check in the pipeline compares it with what the migrations generate and fails if it differs.

## The intro, for fun

The new room was built, so the floor plan by the door needed a new box too.

## The punchline, for fun

The inspector compares the drawing with the walls on the next visit anyway.

## The options, in plain words

A. Keep the hand-written entry, checked by the pipeline's database job (built).
B. Regenerate the file with the database tool before the feature merges.

## What I had to decide

Whether the hand-written entry stays, or is regenerated with the database tool before the feature merges.

## What I did meanwhile

The app type-checks with the new table; the pipeline's database job proves the entry matches the migrations.

## What it costs to change later

Regenerating it is one command against a local database, then one commit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No local database with the latest migrations was free on this machine, so the entry was written by hand, not generated. (author)
