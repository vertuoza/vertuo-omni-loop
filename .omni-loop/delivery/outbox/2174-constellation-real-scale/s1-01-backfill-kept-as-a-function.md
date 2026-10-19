---
id: s1-01-backfill-kept-as-a-function
prd: 2174
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

Should the one-time fill of every past PRD's targets stay in the database as a named step that can be run again, or run once and leave nothing behind?

## The decision, in plain words

The one-time fill is kept as a named step only the database itself may run. The migration runs it once, and the database check runs the very same step to prove it fills a PRD planned before the table existed.

## The intro, for fun

A one-time job that sticks around afterwards, just in case.

## The punchline, for fun

It runs once on release day and then waits quietly in the cupboard.

## The options, in plain words

A. A. Keep the fill as a named step only the database runs, called once by the migration and again by its check (built).
B. B. Inline the fill in the migration and drop the named step; the check repeats the same statement to prove it.

## What I had to decide

Keep A, or choose B and the next migration drops prd_targets_backfill() and inlines its loop.

## What I did meanwhile

Nothing waits on it: no client may run the step, and it only rewrites rows the plan push would write anyway.

## What it costs to change later

B is one small follow-up migration; the check would then copy the loop instead of calling the migration's own step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the migration backfills once; it does not say whether the step may stay afterwards (author).
