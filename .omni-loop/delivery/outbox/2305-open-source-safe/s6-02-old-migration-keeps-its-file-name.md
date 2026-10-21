---
id: s6-02-old-migration-keeps-its-file-name
prd: 2305
slice: s6
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

One old database step now does nothing, but its file name still carries the company's name. Should the file be renamed, or kept as it is?

## The decision, in plain words

The file keeps its name. Its content no longer names the company or does anything, and renaming a step the live database already ran is a risk the plan never asked to take.

## The intro, for fun

The step was emptied out, but its name tag is still sewn into the collar.

## The punchline, for fun

A label on an empty box is history, not a secret.

## The options, in plain words

A. Keep the file name; only its content changed (built).
B. Rename it to a neutral name with the same version, after checking the deploy job accepts it.

## What I had to decide

Whether supabase/migrations/20260926160000_vertuoza_sectors.sql keeps its name (built), or is renamed with its version unchanged, once someone confirms the deploy job treats a renamed applied migration as already applied.

## What I did meanwhile

The file holds a comment and `select 1;` only; a fresh install applies it and creates nothing. The open-source guard reads contents, not file names, so it passes.

## What it costs to change later

Renaming later is one git mv, after checking supabase db push against production's migration history; keeping it costs nothing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether supabase db push --include-all compares a migration's name as well as its version was not checked against production (author).
