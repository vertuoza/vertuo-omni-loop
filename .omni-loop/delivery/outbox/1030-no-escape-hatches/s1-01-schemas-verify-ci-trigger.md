---
id: s1-01-schemas-verify-ci-trigger
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

When should the database check that every stored row still matches what the code expects run on a pull request, and how much of the local database stack does it need?

## The decision, in plain words

It runs on every pull request that changes the source of the arcade or the App, not only the database folder, and the check now starts the database's web API as well as the database, because the reads go through that API exactly as they do in production.

## The intro, for fun

Every schema wants its day in front of a real database.

## The punchline, for fun

So the database check now shows up to a lot more parties.

## The options, in plain words

A. Run on every change to the arcade's and the App's source, starting the API too: the option built.
B. Run only when a boundary file, the script or the database folder changes, and ask each slice to keep its schemas in the boundary file, so the job runs less often.
C. Agree on a schema file name beside each module and trigger on that name, at the price of one more convention for the wave-2 slices.

## What I had to decide

Whether the supabase workflow's pull-request job should run on every change to the arcade's and the App's source (so a schema edited inside its module always meets the database), and start the API services rather than the database alone.

## What I did meanwhile

The trigger lists the two source folders, every boundary file and the verify script, and the job starts the database with PostgREST, Kong and Auth (all other services left out). Narrowing it later is one list in the workflow.

## What it costs to change later

A few more minutes of CI on pull requests that touch the arcade's or the App's source but no schema; the job's time limit went from 15 to 20 minutes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) not yet timed on a GitHub runner: the extra images and the install were only measured on a local machine
- the plan says the trigger holds every schema file, but schemas live inside their modules, so no narrower pattern names them
