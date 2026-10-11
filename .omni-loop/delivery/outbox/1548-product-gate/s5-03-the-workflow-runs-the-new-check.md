---
id: s5-03-the-workflow-runs-the-new-check
prd: 1548
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

This slice was meant to touch only the database files. The new database check also had to be added to the automatic checks run on every pull request: may that one change stay?

## The decision, in plain words

Yes, kept. The database workflow now runs the new outbox check, as the repository's rules ask of every new check, the same change the first slice made for its own.

## The intro, for fun

A brand new test is no use if nobody ever sits it.

## The punchline, for fun

So we put its name on the exam timetable too.

## The options, in plain words

A. A. Keep the step in this slice (built).
B. B. Move it to a later slice and leave the check unrun until then.

## What I had to decide

Confirm the one change outside the territory: a step in .github/workflows/supabase.yml that runs supabase/checks/outbox_items.sql.

## What I did meanwhile

The step sits right after the product_prd_ids step, worded like its neighbours (conventions: a new database check runs in CI, PRD 902 s1-02).

## What it costs to change later

Five lines to remove; without them the check proves nothing in CI.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s5 does not list the workflow, and conventions require the step in the pull request that adds the check.
