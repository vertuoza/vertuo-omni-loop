---
id: s13-01-data-nav-ceiling
prd: 976
slice: s13
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Fixing the sign-up test helper this slice owns also cleared nine warnings in the sign-in tests of another slice's area, whose count lives in that slice's file. Who writes the new count?

## The decision, in plain words

This slice lowered the other area's count by the nine warnings its fix cleared, so the shared check stays exact and green; the sibling slice clearing that area will set it to zero anyway.

## The intro, for fun

One fix in our yard tidied nine weeds in the neighbour's garden.

## The punchline, for fun

We wrote the neighbour's new weed count on their gate, in pencil.

## The options, in plain words

A. A. This slice lowers the data and navigation count by the nine warnings its fix cleared.
B. B. Keep the sign-up test helper as it was, leaving those nine warnings for the sibling slice to clear from outside its own ground.
C. C. Leave the count as it was and let the wave's merge set it once for every slice.

## What I had to decide

Whether a slice may lower a sibling area's lint count when its own fix, inside its own ground, clears findings there.

## What I did meanwhile

The data and navigation area's ceiling went from 436 to 427; nothing else in that file changed.

## What it costs to change later

A constant: one number in one file. The sibling slice clearing that area edits the same line, so the merge may need it recomputed (to 0 once that slice lands).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives each slice its own ceiling file and says nothing of a fix in one area clearing findings in another (author)
