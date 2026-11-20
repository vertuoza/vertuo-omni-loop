---
id: s4-01-notebook-job-wired-outside-territory
prd: 3107
slice: s4
rank: medium
bears-on: none
raised: 2026-11-20
wave: 4
---

## The question, in plain words

The notebook job has to run on its own every day, but the place where background jobs are listed was not part of this piece of work. Should it be switched on here?

## The decision, in plain words

I switched it on: the daily job is listed with the others, and the database checks for the notebooks and for the fleet messages now run on every pull request.

## The intro, for fun

A job that nobody schedules is a very well written diary nobody opens.

## The punchline, for fun

So the diary got a daily alarm clock, and the checks got a seat on the bus.

## The options, in plain words

A. Switch it on here: the schedule line, the worker line and both database checks in CI, as built.
B. Leave the job built but off, and switch it on in a follow-up change.
C. Switch the job on, but leave the s3 check out of CI and add it in its own change.

## What I had to decide

Added the commander-notebook kind to the App's schedules (daily, 3 tries) and its handler to the worker in apps/omni-app/src/jobs/, with the schedule test updated; added two steps to the supabase workflow, commander_notes.sql and commander_messaged.sql (the s3 check was in no step, so CI never ran it).

## What I did meanwhile

The job is built and tested as its own module; the wiring is three lines and the workflow two steps.

## What it costs to change later

Low: removing the schedule line and the handler line turns the job off; the workflow steps are independent.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names apps/omni-app/src/missions/notebook only; the schedule and the worker live in apps/omni-app/src/jobs/, and the workflow in .github/workflows/
