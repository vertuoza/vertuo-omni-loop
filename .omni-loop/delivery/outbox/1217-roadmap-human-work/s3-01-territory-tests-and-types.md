---
id: s3-01-territory-tests-and-types
prd: 1217
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Adding the new sorting setting changes a few files the plan did not list for this part of the work. May it touch them?

## The decision, in plain words

Yes. Two existing tests that count the settings now count one more, and the database's type file gains the new column and the two new database calls, as the database itself now has them.

## The intro, for fun

The plan drew a neat fence around this slice, and two tests stood just outside it.

## The punchline, for fun

They counted five settings, and there are six now, so they had to learn to count.

## The options, in plain words

A. Change the two tests and the types file in this slice (built).
B. Leave them to a follow-up slice, with the settings tests red until then.

## What I had to decide

Whether this slice may change apps/galaxy/src/jev/settings/render.test.ts, apps/galaxy/src/jev/decisions/question-category.test.ts and supabase/database.types.ts, outside its territory.

## What I did meanwhile

Both tests list the six decisions instead of five, and the settings page test checks hitl-category shows Off by default with what it sends. supabase/database.types.ts is edited by hand as `supabase gen types` would write it (the classified_at column, roadmap_human_work_claim and roadmap_human_work_set_kind); CI's types check confirms it.

## What it costs to change later

Low: these are a list in two tests and generated types; another slice owning them would make the same edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The types file was edited by hand, not generated: the supabase CLI was not available here, so CI's types check is the first to compare it (author).
