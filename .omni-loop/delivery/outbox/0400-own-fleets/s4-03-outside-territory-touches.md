---
id: s4-03-outside-territory-touches
prd: 400
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

May this slice touch a few lines of arcade screens that belong to another slice, to finish removing the company's fleets?

## The decision, in plain words

Yes, the smallest possible touch: the arcade hands a fleet's mascot to the sound it plays, the mascot parade reads the shared mascot list, and two code comments stop naming company fleets. The practice data file for local databases is not regenerated.

## The intro, for fun

The last few crumbs were on the neighbour's side of the table.

## The punchline, for fun

We swept them anyway and left a note on the fridge.

## The options, in plain words

A. Touch the few lines outside the slice, and leave the local practice database file as it is, as built.
B. Touch the lines, and regenerate the local practice database file too.
C. Keep the old sound call by name and look the mascot up inside the sound, leaving the arcade's main screen untouched.

## What I had to decide

Whether to change files outside this slice's area: the arcade's main screen, where a fleet's sound is played, the arcade's fleet helpers, and two comments on the fleet screens.

## What I did meanwhile

Two calls now pass the whole fleet to the sound, the parade's list comes from the shared mascot library, and two comments were reworded. The local practice database file still holds the company's fleets until someone regenerates it.

## What it costs to change later

Four small edits, each undone by reverting a line or two.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gave the sound and the picture lookup to this slice but their callers to the arcade slice
- (author) whether the local practice database file should be regenerated in this feature
