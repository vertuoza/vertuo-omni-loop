---
id: s1-02-api-keys-check-in-ci
prd: 2022
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The new database check for API keys only proves something if the automatic checks run it on every change. Should this slice add it to them, though that file lies outside the ground it was given?

## The decision, in plain words

We added the check to the automatic database checks, as the team's own rule asks for every new check, and say so here because it reaches past the slice's ground.

## The intro, for fun

A test nobody runs is a very quiet test.

## The punchline, for fun

So we gave it a seat in the checks that run every time.

## The options, in plain words

A. Add the step in this slice, as the conventions form asks of the pull request that adds a check (built).
B. Leave the workflow untouched and add the step in a follow-up pull request, the check unrun until then.

## What I had to decide

Whether the slice that adds supabase/checks/api_keys.sql also adds its step to .github/workflows/supabase.yml, outside the plan's territory for s1.

## What I did meanwhile

The step is added after the runner job lines step; no other slice of PRD 2022 touches the workflow, so no sibling collides with it.

## What it costs to change later

One workflow step; removing it is one revert.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the workflow belongs to a slice territory of its own in later plans (author)
