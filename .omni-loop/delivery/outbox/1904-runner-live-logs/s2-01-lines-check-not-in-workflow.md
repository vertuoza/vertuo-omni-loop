---
id: s2-01-lines-check-not-in-workflow
prd: 1904
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The new database check that proves only team members can read a job's live lines is written, but the automatic database run does not start it yet, because that file lies outside this slice's area.

## The decision, in plain words

The check was written and left for the wave to switch on in the automatic database run after this slice merges, rather than reaching outside the slice to do it here.

## The intro, for fun

A smoke alarm is only useful once someone puts in the battery.

## The punchline, for fun

The alarm is on the ceiling; the battery is one line away.

## The options, in plain words

A. A. Leave it to the wave, which switches the check on after this slice merges (as built).
B. B. Have this slice switch the check on itself, outside its own area.
C. C. Fold the new checks into the runners check the automatic run already starts.

## What I had to decide

Add one step running supabase/checks/runner_job_lines.sql to .github/workflows/supabase.yml, beside the runners check, on the feature branch once s2 merges.

## What I did meanwhile

Until that step exists, the access rules of runner_job_lines are pinned as text by apps/galaxy/src/runners/runners.migration.test.ts, but not proven against a database in CI.

## What it costs to change later

One step of the workflow, a few seconds per run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The check was not run against a local database here: no Supabase or Docker daemon was available (author).
