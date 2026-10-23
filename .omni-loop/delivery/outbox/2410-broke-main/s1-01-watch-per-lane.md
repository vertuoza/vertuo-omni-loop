---
id: s1-01-watch-per-lane
prd: 2410
slice: s1
rank: high
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When one PRD lands in several repositories, how should its watch on main be kept: one per repository it landed in, still tied to the PRD it came from?

## The decision, in plain words

Each PRD keeps one watch for every repository it landed in, and each watch still names the PRD's own home and number. The rewind's findings belong to the PRD as a whole.

## The intro, for fun

One PRD, three repositories, one question: who is watching which main?

## The punchline, for fun

Everyone watches their own main, and the PRD still knows they are all family.

## The options, in plain words

A. A. One watch per PRD and lane: the PRD's own repository and number, and the repository it merged into (built).
B. B. One watch per repository merged into and PRD number, as the page drew it: a plan repository's PRD can then share its number with a target's own PRD.
C. C. One watch per PRD, its lanes kept as a list inside the one row.

## What I had to decide

Whether `prd_main_watch` is keyed by the PRD's repository, its number and a `lane` (the repository merged into), as `prd_milestones` is (built), instead of the before/after page's `repository` and `prd` alone. Breaks carry the lane; `rewind_findings` carry the PRD's repository and number, with no lane and no foreign key to a watch. Decided by: Jev (hardToRevert 0.54) · agent said true

## What I did meanwhile

Built as option A in supabase/migrations/20261229090000_main_watch.sql: the key is (workspace_id, repository, prd, lane), and a one-lane PRD has its own repository as its lane. s2, s3 and s4 read and write it so.

## What it costs to change later

Changing the key once rows exist in production is a migration that rewrites them; before the feature PR merges it is an edit of this one migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the page drew `repository` and `prd` only; whether it meant the target repository there is not said, and a plan repository's PRD number would then collide with the target's own PRD of the same number
- (author) a finding has no foreign key to a watch, so the table does not itself refuse a finding for a PRD that has none: that is left to s5's endpoint
