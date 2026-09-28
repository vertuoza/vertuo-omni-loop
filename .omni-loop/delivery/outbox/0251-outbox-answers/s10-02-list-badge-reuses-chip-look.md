---
id: s10-02-list-badge-reuses-chip-look
prd: 251
slice: s10
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

How should the count of waiting questions and the Needs an answer choice look in the list of plans?

## The decision, in plain words

The count looks like the other small labels on a row and reads Outbox 2 open, the same words as the tab on the plan's page. Needs an answer is a plain tick box among the other filters, with no new styling.

## The intro, for fun

A new label walked into the list and borrowed a neighbour's jacket.

## The punchline, for fun

It fits well enough, though nobody tailored it.

## The options, in plain words

A. Reuse the existing chip look for the count, and a plain tick box for the filter.
B. Give the count its own accent colour so waiting questions stand out, and style the tick box like the Mine and All switch.
C. Make Needs an answer a third switch beside Mine and All instead of a tick box.

## What I had to decide

The spec asks for n open on each row and a Needs an answer filter, but gives no look. The page's stylesheet belongs to another slice, so this slice adds no style to it.

## What I did meanwhile

The count reuses the existing artifact chip look, reading Outbox then 2 open, placed after the artifact chips. The filter is a checkbox inside the same field layout as the other picks, under a hint reading Outbox.

## What it costs to change later

A few lines of markup and a small stylesheet change, in a later slice or a follow-up. Nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the count should stand out more than the artifact chips, for instance in the accent colour, so waiting questions catch the eye.
