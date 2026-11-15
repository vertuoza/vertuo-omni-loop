---
id: s7-05-database-check-needs-its-ci-step
prd: 2898
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The new database check proves only workspace members read the ready verdicts and only the App writes them, but the build runs each database check by name from a file outside this slice's area. Who adds the line that runs it?

## The decision, in plain words

The slice wrote the check and ran it by hand on a local database, where it passed, and left the build's file alone. It runs in the build once someone adds its line there.

## The intro, for fun

We installed a smoke alarm and tested the button ourselves.

## The punchline, for fun

Someone still has to wire it to the building's panel.

## The options, in plain words

A. A. Leave the build's file to the wave or a later slice, the check committed and proven by hand: what was built.
B. B. Add the line in this slice, outside its area, with an item excusing that file.

## What I had to decide

`.github/workflows/supabase.yml` lists every `supabase/checks/*.sql` as its own step; it is in no slice's territory of PRD 2898. s7 ran `supabase/checks/ready_verdicts.sql` with the migration in one rolled-back transaction on the local database: it passed and left nothing behind. The step to add, after the missions check: `run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/ready_verdicts.sql`. The wave, or s10, may add it with an item that excuses the workflow file.

## What I did meanwhile

Left the workflow untouched; the check is committed and passes locally.

## What it costs to change later

Two lines in one workflow file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the wave adds the step when it merges, or a person prefers s10 to
