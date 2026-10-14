---
id: s5-01-contracts-line-where
prd: 1870
slice: s5
rank: medium
bears-on: none
raised: 2026-10-14
wave: 4
---

## The question, in plain words

The command that shows a repository's working rules now says whether its plans must name what each step changes for others. The spec left open on which of the command's views that line appears, and how the machine-readable answer carries it.

## The decision, in plain words

The line appears only on the overview, as its second line, right under the heading and before the areas and their hooks. The machine-readable overview, which used to be a plain list, is now a small record holding that list and the new answer side by side.

## The intro, for fun

One new line, three possible homes, and the spec only gave a street name.

## The punchline, for fun

We picked the house the planner actually knocks on.

## The options, in plain words

A. A. Overview only, second line, and the machine-readable overview becomes a record of the list and the answer
B. B. Also print the line on the single-point and single-path views
C. C. Keep the overview's machine-readable form a plain list and add the answer only to the text

## What I had to decide

Keep the line on the overview only, or also print it on the single-point and single-path views.

## What I did meanwhile

Planning reads the overview, so the plan skill sees the line today; the per-point and per-path views are unchanged.

## What it costs to change later

Printing it elsewhere too is a few lines and a test update; going back to a plain list for the overview is a one-line change, though anything that read the list must follow.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nothing in the repository reads the overview's machine-readable form today besides its own test, so the shape change breaks no known reader (author)
