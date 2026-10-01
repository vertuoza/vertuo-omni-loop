---
id: s1-02-budget-check-in-ci
prd: 902
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The new check that proves nobody in a browser can read the GitHub budget is written, but the pipeline that runs database checks lists each one by hand and that list sits outside this slice. Should it be added there?

## The decision, in plain words

I wrote the check and ran it by hand against a fresh local database, where it passed, but left the pipeline's list untouched since it lies outside this slice.

## The intro, for fun

The new guard dog is trained and ready.

## The punchline, for fun

Somebody still has to put it on the night shift roster.

## The options, in plain words

A. Add one step for the new check to the supabase workflow, in the feature branch, before it ships.
B. Leave it to a follow-up that runs every check in the folder in one step.
C. Leave the check as a by-hand script.

## What I had to decide

The plan asks for a check under `supabase/checks/` proving the two tables are readable by no browser role. The `supabase` workflow runs each check as its own named step, and `.github/workflows/supabase.yml` is not in s1's territory.

## What I did meanwhile

Wrote `supabase/checks/github_budget.sql` and ran it, with every other check, against a local database built from all migrations: it passes. The workflow does not run it yet.

## What it costs to change later

One step in the workflow, a few lines, at any time; until then a later change could open the tables without CI noticing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person who owns the workflow wants one step per check, as today, or one step that runs every file in the folder (author).
