---
id: s2-01-heartbeat-access-check-in-ci
prd: 757
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The plan asked for a test that proves who may see and change the new working records, but the place where such database tests live was not in this piece of work's area.

## The decision, in plain words

I added the database test beside the others and one line to the pull request checks that runs it, so every pull request proves the access rules for real.

## The intro, for fun

A lock nobody has tried is only a nice-looking door.

## The punchline, for fun

So we added one more key to the ring that gets tested on every pull request.

## The options, in plain words

A. Keep the database check and its workflow step, outside the slice's area, as built.
B. Drop the database check and keep only the text and fake-database tests inside the slice's area.
C. Move the check into a follow-up change that owns the tests folder and the workflow.

## What I had to decide

The slice's done-when asks for a persistence test with realistic rows (the owner upserts their row, another user cannot write it, a member reads it, a non-member reads nothing). The repository runs such tests as SQL files under supabase/checks/, one step each in .github/workflows/supabase.yml. Neither path is in s2's territory, which names only the migration, the route folder and src/working/.

## What I did meanwhile

Added supabase/checks/working_pings.sql, written like supabase/checks/dossiers.sql, and one step in .github/workflows/supabase.yml that runs it on every pull request touching supabase/. Inside the territory, src/working/migration.test.ts pins the migration's rules as text and src/working/api.test.ts proves the route against an in-memory fake of working_ping().

## What it costs to change later

Low. Removing the check is deleting one file and one workflow step; nothing reads either at runtime.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The SQL check was not run locally: no Supabase CLI or psql on this machine, so the sub-PR's supabase workflow is its first real run (author).
