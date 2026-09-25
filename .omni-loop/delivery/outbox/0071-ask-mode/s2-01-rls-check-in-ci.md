---
id: s2-01-rls-check-in-ci
prd: 71
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The plan kept this slice away from the shared database checks and the automatic check runs, yet the test that proves one person cannot see another's ask sessions only protects anyone if it runs on every change. Should it run there?

## The decision, in plain words

The privacy test sits next to the game's own database test and runs automatically on every change that touches the database, just as that one does.

## The intro, for fun

A lock nobody ever tries is just a decoration on the door.

## The punchline, for fun

So this one gets its handle rattled on every change.

## The options, in plain words

A. Keep the privacy test next to the game's database test, run automatically on every database change, the option built.
B. Keep the privacy test inside this slice's own folders, and run it only by hand.
C. Fold the privacy test into the game's existing database test, so the whole database has one test.

## What I had to decide

The plan's territory for s2 names the migration, the ask routes and `apps/galaxy/src/ask/{api,store,auth}`, but not `supabase/checks/` or `.github/workflows/supabase.yml`. The done-when asks for "an RLS test run with two JWTs". The repository's only RLS check is `supabase/checks/access.sql`, which the `supabase` workflow runs with psql after `supabase db start` on every pull request touching `supabase/**`. A check file inside s2's own paths would run nowhere but by hand.

## What I did meanwhile

Added `supabase/checks/ask.sql` (the claims of two accounts' access tokens: A never reads, updates or deletes B's sessions or rounds, B never asks in A's session, an outsider opens nothing; plus the round's forward-only moves, the grants and the expiry) and one step in `.github/workflows/supabase.yml` that runs it after the access check. Both paths are outside s2's territory: a breach the wave reports.

## What it costs to change later

Removing it is deleting one file and one workflow step. Folding it into `access.sql` is a cut and paste. s3's own migration (`ask_cli_codes`) may want its checks beside it, in the same file or a step of its own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan left `supabase/checks/` and the workflow out of s2's territory on purpose, or overlooked that the RLS test needs a place to run.
