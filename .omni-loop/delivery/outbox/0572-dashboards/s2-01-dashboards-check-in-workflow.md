---
id: s2-01-dashboards-check-in-workflow
prd: 572
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new database check for the dashboards only runs when the database workflow names it. Should this slice add it there, even though that workflow is not in its part of the plan?

## The decision, in plain words

I added one step to the database workflow so the new check runs on every pull request, like the others.

## The intro, for fun

A safety check nobody runs is just a very tidy wish.

## The punchline, for fun

So it now runs with its siblings, every single time.

## The options, in plain words

A. Keep the step, so the check runs on every pull request.
B. Remove the step and leave the check for a person to run by hand.

## What I had to decide

Whether the check file supabase/checks/dashboards.sql gets a step in .github/workflows/supabase.yml, a file outside s2's territory.

## What I did meanwhile

Added one step, 'What the dashboards read', after the outbox sends check; the rest of the workflow is untouched.

## What it costs to change later

Removing the step is one deletion; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant another slice to wire the check in (author)
