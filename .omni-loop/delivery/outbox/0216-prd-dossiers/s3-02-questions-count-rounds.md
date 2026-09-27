---
id: s3-02-questions-count-rounds
prd: 216
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

The Questions tab shows how many questions were answered out of those asked. When Claude asks several questions at once, does that count as one or as one per question?

## The decision, in plain words

As one: each time Claude asks counts once, and it is answered when all of it is answered. The list shows the same thing, one card each, so a card holding three questions counts once.

## The intro, for fun

Three questions arrived in one envelope and argued about who gets counted.

## The punchline, for fun

The envelope counts. The questions share a stamp.

## The options, in plain words

A. Count each time Claude asks, one card each
B. Count every question inside it, so one card may count as three

## What I had to decide

Whether the tab's count, and the counts later slices build from the same list, count each ask or each question inside it.

## What I did meanwhile

The page counts rounds: one AskUserQuestion call each, answered or not as a whole, so the count matches the cards listed. The history list and the planet's tab of later slices read the same rows.

## What it costs to change later

A constant in the page's view, and the same in the later slices that count too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says answered out of asked, and for the planet n asked and n answered, without saying what one is; its user story speaks of eleven of twelve questions.
