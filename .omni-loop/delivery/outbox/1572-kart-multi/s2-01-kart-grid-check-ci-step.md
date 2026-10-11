---
id: s2-01-kart-grid-check-ci-step
prd: 1572
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The new check that proves who may join the kart grid has to run on every pull request, but the file that lists the checks is outside this slice's lane. Who adds the line?

## The decision, in plain words

The check and the rule are written, but the line that makes the pull request checks run it is left for the feature branch, so the slice stays in its lane.

## The intro, for fun

A referee who is not on the rota still has to be called onto the pitch.

## The punchline, for fun

Until someone whistles for the check, it plays only in the changelog.

## The options, in plain words

A. A. Leave the list of checks alone in this slice and add the line when the feature branch is finished (built).
B. B. Widen this slice's lane to the list of checks and add the line here.

## What I had to decide

Add one named step for supabase/checks/kart_grid.sql to the supabase workflow's check job, in the feature PR or in a later slice, before the feature PR is marked ready. The conventions say a check CI does not run proves nothing.
Decided by: Jev (hardToRevert 0.66) · agent said false

## What I did meanwhile

The check file is committed and was run against a stand-in database during the build, but CI does not run it yet.

## What it costs to change later

One step of about three lines in .github/workflows/supabase.yml; no migration, no data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The slice could not run the check against a real Supabase database here: no local Supabase CLI. The realtime.messages grants and partitions are assumed to be those of a stock Supabase project (author).
