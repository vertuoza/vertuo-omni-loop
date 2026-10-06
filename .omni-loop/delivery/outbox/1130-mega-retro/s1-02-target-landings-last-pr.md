---
id: s1-02-target-landings-last-pr
prd: 1130
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

When a repository received the work in several stacked deliveries, the retro reads the work of all of them but takes the last delivery's pull request as that repository's feature PR. Should each delivery get its own timeline and churn instead?

## The decision, in plain words

Each repository is read once: every slice of every delivery counts, and the last delivery's pull request stands for the repository's feature PR in its timeline and final diff.

## The intro, for fun

A repository that took the work in three trips still gets one chapter in the retro.

## The punchline, for fun

The last trip signs the chapter, and the earlier ones are in the footnotes.

## The options, in plain words

A. A. One reading per repository, the last delivery standing for its feature PR, as built.
B. B. One reading per delivery of each repository, each with its own timeline and churn.
C. C. One reading per repository, its timeline spanning from the first delivery's opening to the last one's merge.

## What I had to decide

Whether a repository built in several deliveries is described once, or once per delivery.

## What I did meanwhile

Every delivery's pull request is listed under that repository; its timeline and final diff read only the last one.

## What it costs to change later

Small: one more loop over the deliveries in the per-repository read, and one more level in the grouped sections.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No plan of several deliveries across repositories has run yet, so how often this matters is not known (author).
