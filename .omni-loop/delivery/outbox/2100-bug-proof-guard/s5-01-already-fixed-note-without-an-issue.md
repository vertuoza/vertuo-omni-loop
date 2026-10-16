---
id: s5-01-already-fixed-note-without-an-issue
prd: 2100
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

When the multi-repository bug fix finds that a bug is already gone, in a run for a whole product there is no issue to leave the note on. Where should the note saying who fixed it go, and which merged change is named when two both qualify?

## The decision, in plain words

The skill posts nothing in that run and puts the same words in its hand-off to the person. When two merged changes both turn the reproduction from failing to passing, only the earlier one is named as the fix and the other is listed as a maybe.

## The intro, for fun

The bug had already moved out, and there was no mailbox to tell.

## The punchline, for fun

So the note rides along with the hand-off, like a forwarding address.

## The options, in plain words

A. Print the note in the hand-off and post nothing, naming the earlier merge when two qualify, the option built.
B. Post the note on the plan repository's issue when the person named one, and print it otherwise.
C. Stop the product run with a question to the person asking where the note should go.

## What I had to decide

Where the already-fixed note goes when a product run has no issue to hold it, and which merged change is named when two both qualify.

## What I did meanwhile

The note goes in the skill's hand-off to the person, nothing is posted anywhere, and the earlier merged change is named. A different answer changes a sentence of the skill's text.

## What it costs to change later

A sentence or two of the skill's wording, and the test that locks it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a product bug's own page should hold this note once product bugs have a place for comments
- (author) whether two merged changes can both turn the reproduction from failing to passing in practice
