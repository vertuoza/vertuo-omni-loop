---
id: s6-02-fleet-board-outside-territory
prd: 587
slice: s6
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

Counting PRDs by where they are now on the fleet dashboard meant touching the fleet page's loader and three tests, which the plan gave to nobody. Is that fine?

## The decision, in plain words

We changed them, so the fleet dashboard reads the PRDs too instead of saying they could not load.

## The intro, for fun

The plan drew the fence round the board, and the fleet page was standing just outside it.

## The punchline, for fun

We let it in, or its PRD tile would have sulked forever.

## The options, in plain words

A. Keep the changes in this slice, the option built.
B. Move the fleet changes to their own slice before the feature PR is ready.

## What I had to decide

Whether the slice may change the fleet page's loader, its demo and three page tests outside its declared territory.

## What I did meanwhile

The fleet loader reads the PRDs now with the other reads, its demo passes made-up PRDs, and the home and fleet tests pass PRDs too.

## What it costs to change later

Reverting the edits: the fleet dashboard's PRD tile would say it could not load.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a later slice planned to own the fleet loader (author)
