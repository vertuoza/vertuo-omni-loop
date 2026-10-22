---
id: s3-01-s3-outside-territory
prd: 2401
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The new database check, the renamed list function and the new database types needed three small edits in files the slice did not own. Is it fine that the slice made them?

## The decision, in plain words

The slice added the new check to the database workflow, updated the existing dossier check to the list function's new signature, and regenerated the database types, so every check stays green and the new one runs on every pull request.

## The intro, for fun

Three files sat just over the fence, and the slice reached across to tidy them.

## The punchline, for fun

Neighbourly, as long as the neighbour agrees.

## The options, in plain words

A. Keep the three edits in this slice: the conventions ask for the workflow step and the regenerated types in the change that needs them.
B. Move them to a slice of their own, and hold this one until it merges.

## What I had to decide

Keep the three edits (A), or move them to a slice of their own and leave this one red until it merges (B).

## What I did meanwhile

The edits are on the slice branch: the workflow runs the new check `supabase/checks/dossier_reads.sql`, `supabase/checks/dossiers.sql` names `dossier_list(uuid, uuid, text)`, and `supabase/database.types.ts` is what `node scripts/supabase-types.ts` wrote from the migrations.

## What it costs to change later

A: none. B: one more slice and a red supabase workflow on this sub-PR until it lands.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s3 names `supabase/checks/dossier_` but not `supabase/checks/dossiers.sql`, the workflow or the generated types, which every migration that changes a function's signature touches (author).
