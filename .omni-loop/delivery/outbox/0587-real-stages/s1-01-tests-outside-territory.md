---
id: s1-01-tests-outside-territory
prd: 587
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Building this part meant also changing two older page tests and the list of database checks, which the plan gave to nobody. Is that fine?

## The decision, in plain words

We changed them, because the tests still expected the old stage unknown message and the new database check would otherwise never run.

## The intro, for fun

The plan drew a fence, and two old tests were standing just outside it.

## The punchline, for fun

We invited them in rather than leave them shouting about a message that no longer exists.

## The options, in plain words

A. Keep the changes in this slice, the option built.
B. Move the test and workflow changes to their own slice before the feature PR is ready.

## What I had to decide

Whether a slice may change tests and the database-check workflow outside its declared territory when its own done-when requires it.

## What I did meanwhile

render.test.ts and page.test.ts under apps/galaxy/src/dossier/page now pass stored stages, and .github/workflows/supabase.yml runs supabase/checks/prd_stages.sql.

## What it costs to change later

Reverting the three files: the old tests would fail and the new check would stop running.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a later slice planned to own these files (author)
