---
id: s10-01-ci-runs-pack-checks
prd: 2011
slice: s10
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The two new database checks for knowledge packs and the plan repository only protect us if the automatic checks run them, and the file that lists them sits outside this slice's ground. Who adds them?

## The decision, in plain words

This slice added both checks to the automatic database checks itself, the same way the bug records slice did, so they run on every pull request.

## The intro, for fun

A safety check nobody runs is just a very tidy wish.

## The punchline, for fun

So both new checks joined the line-up on day one.

## The options, in plain words

A. A. Keep both steps: the new checks run on every pull request (as built)
B. B. Drop the steps and let a person add them on the feature branch before it is marked ready
C. C. Drop the steps and run the checks by hand only

## What I had to decide

Whether s10 may add two steps to the supabase workflow, outside its territory, so the new checks run in CI as the conventions form asks.

## What I did meanwhile

Added two steps to .github/workflows/supabase.yml, after the fix rows step, running supabase/checks/knowledge_packs.sql and supabase/checks/products.sql the way every other check runs. Nothing else in the file changed.

## What it costs to change later

A constant: removing either step is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists both check files in s10's territory but not the workflow that runs them, and no slice of landing 3 owns .github/; the conventions form says a new check runs in CI in the pull request that adds it
