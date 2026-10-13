---
id: s1-01-runners-check-in-ci
prd: 1830
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The new database check for runners must run on every pull request, but the file that lists those checks was not in this slice's ground. Should this slice add its step there?

## The decision, in plain words

I added one step to that list so the new check runs on every pull request, as the repository's rules ask for each new database check.

## The intro, for fun

A check that never runs is a smoke alarm with no battery.

## The punchline, for fun

So the battery went in, one aisle over from where the plan said to shop.

## The options, in plain words

A. Keep the step in the workflow, so the check runs on every pull request
B. Remove the step and leave the check file unused until a later change wires it in

## What I had to decide

Whether the runners' database check runs in the continuous integration list, added by this slice although that list sits outside its planned ground.

## What I did meanwhile

Added one step, `Who may read and write the runners, and how a runner claims a job`, to the supabase workflow's check job, after the outbox items step. No other line of that file changed.

## What it costs to change later

A constant: removing the step is deleting seven lines; keeping it costs nothing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 named supabase/checks/ but not the workflow that runs each check (author).
