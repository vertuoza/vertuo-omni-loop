---
id: s2-02-the-product-approvers-check-expects-email-on-by-default
prd: 2608
slice: s2
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

Is it fine that this slice also edited the older product approvers database check, which is outside its planned files?

## The decision, in plain words

Turning email on by default made one line of that older check wrong, because it still expected both alert switches off. I changed that one expectation to push off and email on, and nothing else in the file.

## The intro, for fun

A new default walked in and an old sign still said otherwise.

## The punchline, for fun

One line of the sign was repainted.

## The options, in plain words

A. A. Update the one expectation here (as built).
B. B. Revert it and fix it in a separate pull request, leaving CI red meanwhile.

## What I had to decide

Whether to update the older check inside this slice or leave it red for another slice.

## What I did meanwhile

Only the expected row and its failure message changed; the check passes against a fresh local database.

## What it costs to change later

One line in one check file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice does not list the older check; the change was needed to keep CI green.
