---
id: s1-04-database-check-needs-its-ci-step
prd: 2268
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The new database check proves how the product is found from a repository, but a check only counts once the automatic build runs it, and the build's file is outside this slice's ground. Who adds it?

## The decision, in plain words

The slice wrote the check and ran it green on a local copy of the database, and left the build file alone. The step that runs it is one line for the feature branch to add before the feature is marked ready.

## The intro, for fun

A smoke alarm in the box still counts as a smoke alarm, technically.

## The punchline, for fun

One screw on the ceiling and it starts earning its keep.

## The options, in plain words

A. The feature branch adds the step after this wave merges, before the feature is marked ready.
B. Grow this slice's ground to the build file and add the step here.

## What I had to decide

Where the step that runs `supabase/checks/knowledge_product_for_repo.sql` goes: the conventions form says each check is its own step of the `supabase` workflow's `check` job, added in the pull request that adds the check, and `.github/workflows/supabase.yml` is outside s1's territory.

## What I did meanwhile

Built the check and ran it green against every migration applied to a local Postgres (supabase/postgres 17.6.1.167); `knowledge-api.migration.test.ts` pins the function's rules in the unit run meanwhile. No workflow file changed.

## What it costs to change later

A constant: one named step in `.github/workflows/supabase.yml`, `psql … -f supabase/checks/knowledge_product_for_repo.sql`, beside the `product_archive.sql` step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The local copy stubbed what the Supabase platform adds to the auth, storage and realtime schemas, so the run in CI is the one that counts (author)
