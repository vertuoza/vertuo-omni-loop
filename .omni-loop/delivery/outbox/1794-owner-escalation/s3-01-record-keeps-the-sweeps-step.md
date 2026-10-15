---
id: s3-01-record-keeps-the-sweeps-step
prd: 1794
slice: s3
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When the check rewrites the waiting list on a pull request, should it work out each thing's step itself from the clock, or keep the step the hourly reminder last reached?

## The decision, in plain words

The check only adds new waiting things and drops answered ones; it keeps each existing line exactly as the hourly reminder left it, so the list never claims more people were asked than were really told.

## The intro, for fun

Two clocks on one wall never agree for long.

## The punchline, for fun

So only one of them is allowed to move the hands.

## The options, in plain words

A. The check keeps each listed thing's step as the hourly reminder left it, and only adds or drops things.
B. Every check run works out each thing's step from the clock and rewrites it, and the hourly reminder only posts what is not yet posted.

## What I had to decide

Answer A to keep the step owned by the hourly reminder alone, or B to let every check run move the step from the clock.

## What I did meanwhile

A thing seen for the first time starts at step 0 with nobody new asked; a thing already listed keeps its first-held time, step, people asked and next due time until the hourly reminder moves it.

## What it costs to change later

Changing it later is a few lines in the record keeper; no stored shape changes, and the comment's text stays the same.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the sweep moves each due thing and the record keeps first-held time, but not whether the check may also move a step (author).
