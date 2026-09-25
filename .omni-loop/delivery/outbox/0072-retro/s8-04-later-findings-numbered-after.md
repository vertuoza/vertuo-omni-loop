---
id: s8-04-later-findings-numbered-after
prd: 72
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The findings of the second look are of the most severe kind, but the first findings already carry numbers that their issues show. Where do the new ones go in the list?

## The decision, in plain words

The new findings are numbered after the first ones and listed after them, so every finding keeps the number its issue already shows. The list is worst first within each look, not across both.

## The intro, for fun

Late arrivals can outrank the whole queue they walk into.

## The punchline, for fun

They still take a ticket at the back, so no seat has to change.

## The options, in plain words

A. Number and list the new findings after the first ones, the option built.
B. Sort the whole list worst first and renumber every finding, rewriting the open issues to match.

## What I had to decide

`detect` numbers each run's findings from F1, and `render` lists the findings of every run in run order, so both runs would carry an F1. Renumbering across runs, worst first, would change the refs already written in the merge run's issues.

## What I did meanwhile

The day-14 facts step numbers its findings on from the merge run's count; `render` is unchanged.

## What it costs to change later

A constant in `retro.mjs`. Listing worst first across runs needs `render` (s2's file) to sort, and the open issues to be rewritten.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec's worst-first order was meant across the two looks.
