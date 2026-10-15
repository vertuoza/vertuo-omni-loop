---
id: s1-01-beyond-territory
prd: 1975
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

Paying merged pull requests needed three small changes in files this slice's plan did not list. Is that acceptable, or should those changes wait for a later slice?

## The decision, in plain words

The three changes were made in this slice, each as small as it could be, so the new points work and the galaxy view keeps loading once they are written.

## The intro, for fun

The map said stay in the yard, but the gate had a loose hinge.

## The punchline, for fun

Three screws tightened, nothing else touched.

## The options, in plain words

A. A. Keep the three changes in this slice, so the arcade keeps loading once a merged pull request's points are written.
B. B. Undo them here and let the last slice carry them, accepting that the arcade fails to load in between.

## What I had to decide

Keep the three changes in this slice (A), or undo them and let a later slice carry them (B).

## What I did meanwhile

The slice ships with the three changes in it.

## What it costs to change later

Undoing them is a small revert: the shared shape of a read, one filter line in the galaxy view, and one database check file. No stored data depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The database check runs only in the repository's continuous integration, not on this machine: it was not run here. (author)
- The three files outside the territory: game/types.ts (the snapshot names the merged pull requests), packages/galaxy/src/galaxy.ts (planet 0 left out of the map; it threw on a PRD number 0 without it) and supabase/checks/game_answered_rounds.sql (the ledger takes PR_MERGED and PR_REVIEWED on planet 0). (author)
