---
id: s1-04-the-down-script-is-a-guarded-follow-up
prd: 1548
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Undoing this database change would lose every product PRD's name. How should the undo refuse while any product PRD exists?

## The decision, in plain words

The undo is a later change, as for every other database change here, and its first step is a check kept in the database now that refuses while any product PRD exists. The check is tested both ways.

## The intro, for fun

Every good trapdoor needs a sign saying whether someone is standing on it.

## The punchline, for fun

The sign is installed now, and it shouts if anyone is.

## The options, in plain words

A. A. A guard function now, the follow-up migration written when needed (built).
B. B. A full down script kept beside the migrations, starting with the guard.

## What I had to decide

Confirm that the down script is the follow-up migration the header of 20261203090000_product_prd_ids.sql describes, opened by `select public.product_prd_ids_rollback_guard();`, rather than a down file kept in the repository.

## What I did meanwhile

product_prd_ids_rollback_guard() raises 55000 naming how many product PRDs exist; supabase/checks/product_prd_ids.sql proves it refuses with one and passes with none. The migration's Rollback comment lists everything the follow-up restores and drops.

## What it costs to change later

A down file of its own would be a second copy of four function bodies to keep in step; the guard is one function to drop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The repository keeps no down files: every migration states its rollback as a follow-up migration, so the guard follows that convention.
