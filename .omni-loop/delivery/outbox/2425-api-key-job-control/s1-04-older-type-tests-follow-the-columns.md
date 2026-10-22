---
id: s1-04-older-type-tests-follow-the-columns
prd: 2425
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

Three older tests of the runner tables fail because the database types gained columns. Should this slice update them, though they sit outside its own area, or leave them red?

## The decision, in plain words

This slice updates the three assertions, and nothing else in those two test files. They pin the order of the generated types, so any new column breaks them, and the preflight must be green.

## The intro, for fun

New columns arrived, and the old tests wanted the old seating plan.

## The punchline, for fun

The seating plan is redrawn; nobody else was moved.

## The options, in plain words

A. Update the three assertions in this slice, so the preflight is green and later slices start from green tests.
B. Leave them red and let the first later slice that owns those test files fix them: this slice would not be green on its own.

## What I had to decide

supabase/database.types.ts is s1's alone (plan, shared ground), but apps/galaxy/src/runners/runners.migration.test.ts and runners.questions.migration.test.ts match the generated shape of runner_jobs, runner_job_questions, runner_job_answer and runner_job_dismiss to the column, so s1's new columns and arguments turn three assertions red (lines 163 and 188 of the first, 156 to 158 of the second). Those files are in the territory of s3, s6, s7 and s8 (waves 2 to 6), none of which runs in wave 1. The preflight has to be green for the sub-PR, so the assertions are brought up to the new shape here.

## What I did meanwhile

Edited only those three assertions (the regular expressions), added no test and removed none, and ran both files green. The generated types are unchanged by this.

## What it costs to change later

Moving the edits to another slice later means reverting two small hunks here and re-making them there; s3 would find the files already matching the types.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a later slice of this PRD also edits the same lines: the plan names those files for s3, s6, s7 and s8, and none runs in wave 1.
