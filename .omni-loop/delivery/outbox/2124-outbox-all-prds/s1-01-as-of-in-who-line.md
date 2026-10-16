---
id: s1-01-as-of-in-who-line
prd: 2124
slice: s1
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

Where should a repository question's 'as of' time appear on its row?

## The decision, in plain words

It is written after 'waits on you' in the same line, because the slice may not change the shared question row.

## The intro, for fun

Every clock needs a face to sit on.

## The punchline, for fun

This one borrowed a neighbour's.

## The options, in plain words

A. A. As built: inside the 'waits on' line.
B. B. A dedicated field on the question and its own chip in the shared row.

## What I had to decide

Where to draw the as-of time of a repository row, the row component being outside this slice's territory.

## What I did meanwhile

Added the time to the forWhom text: 'waits on you · as of 2026-10-16 14:05 UTC'.

## What it costs to change later

A constant and a view field if the time later gets its own place in the row.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the design wants the time in its own chip.
