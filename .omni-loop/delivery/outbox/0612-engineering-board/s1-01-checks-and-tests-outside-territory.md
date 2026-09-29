---
id: s1-01-checks-and-tests-outside-territory
prd: 612
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Adding the new settings page meant touching files the plan did not list: the database check list run on every pull request, and three tests that count the sidebar's entries. Is that all right?

## The decision, in plain words

We added the new database check to the list that runs on every pull request, and taught the three sidebar tests about the new Repositories entry. Nothing else outside the plan was changed.

## The intro, for fun

The plan drew a fence, and the sidebar tests lived just over it.

## The punchline, for fun

We stepped over, fixed the count, and stepped back.

## The options, in plain words

A. Keep the four edits, the option built.
B. Move the workflow step to a separate pull request, and keep the three test edits, which the sidebar change forces.

## What I had to decide

Whether slice s1 may change .github/workflows/supabase.yml (one step running supabase/checks/repositories.sql) and three sidebar tests outside its territory (apps/galaxy/src/nav/Sidebar.render.test.ts, apps/galaxy/src/switch/headers.test.ts, apps/galaxy/src/switch/switch.test.ts).

## What I did meanwhile

The four edits are made: one workflow step, and the Repositories entry added to the three tests' expected lists. The plan's done-when asks for the check to pass in the supabase workflow, which needs the step.

## What it costs to change later

Reverting is removing one workflow step and three list entries; the check then never runs in CI and the sidebar tests go red.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant apps/galaxy/src/nav/sidebar to cover Sidebar.render.test.ts, whose name differs only in case (author)
