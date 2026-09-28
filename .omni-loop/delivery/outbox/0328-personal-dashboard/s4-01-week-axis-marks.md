---
id: s4-01-week-axis-marks
prd: 328
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The chart's side scale marks whole numbers from zero to the busiest day. On a busy week, should it mark every single number, even when there are a dozen of them stacked in a small space?

## The decision, in plain words

Up to five merges on the busiest day, every whole number is marked. Past five, the scale counts in round steps of two, five or ten, and always marks the busiest day's number at the top, so it never crowds.

## The intro, for fun

Twelve merges in one day is a great week, and a terrible ladder to print every rung of.

## The punchline, for fun

So past five the scale skips rungs, and the top one always shows the record.

## The options, in plain words

A. Every whole number up to five, then round steps with the busiest day's number at the top, the option built.
B. Every whole number, however many, the marks growing closer as the week gets busier.
C. Only zero and the busiest day's number, whatever the week.

## What I had to decide

How the week chart's y-axis marks its whole numbers when the busiest day has more than five merges: every whole number, as the spec's words could be read, or a round step.

## What I did meanwhile

Every whole number from 0 to the busiest day while it is five or fewer; past five, the smallest step of 2, 5, 10, 20, 50 and so on that keeps five steps or fewer, plus the busiest day's own number at the top, dropping the step's last mark when it would sit within half a step of the top. The busiest bar always reaches the top mark, and no mark is ever a fraction.

## What it costs to change later

One small function in the week's folder and its tests: nothing is stored, and no other part reads it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the axis marks whole numbers only, from 0 to the highest bar, and its sketch shows a week of at most three; it does not say whether a busier week marks every number
- (author) How busy a person's busiest day usually is was not measured: the table fills only once the game workflow runs
