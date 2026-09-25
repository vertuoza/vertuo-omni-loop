---
id: s14-01-ship-needs-committed-tree
prd: 3
slice: s14
rank: high
bears-on: none
raised: 2026-09-25
wave: 9
---

## The question, in plain words

Should the ship step refuse to run until the settled answers are saved in history, and should it ever save the move itself?

## The decision, in plain words

It refuses while the delivery folder has unsaved changes, and it never saves the move itself: a person reviews and commits it.

## The options, in plain words

A. Refuse until the delivery folder is committed, and leave the move for a person to commit, the option built.
B. Commit whatever is pending in the delivery folder first, then move and commit the move too.
C. Move anyway and leave any pending changes mixed into the same unsaved change.

## What I had to decide

What `omni ship` does on a dirty `paths.delivery`, and whether it commits.

## What I did meanwhile

`applyShip` refuses when `git status --porcelain -- <paths.delivery>` is non-empty ("uncommitted changes under <delivery> — commit the settle first"; `omni ship` exits 2, one line). It stages the `git mv` and rewrites, and never commits. yolo-fix commits the settle before shipping.

## What it costs to change later

Small: the refusal is one check in `kit/lib/delivery/ship.mjs`; committing would add a commit author and message convention the kit does not have yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether phase-3 skills will always commit the settle before calling ship, or expect ship to do it.
