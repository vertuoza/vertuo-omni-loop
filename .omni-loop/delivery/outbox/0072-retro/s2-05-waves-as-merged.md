---
id: s2-05-waves-as-merged
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The retro compares the rounds of work the plan intended with the rounds that actually happened, but nothing says how to tell the real rounds apart. How should they be counted?

## The decision, in plain words

A new round starts when a piece of work is picked up after every piece of the current round has been merged or closed; otherwise it joins the current round. Times are counted in whole minutes, from the moment a piece is picked up to its merge.

## The intro, for fun

Counting rounds after the fact is like guessing the songs of a party from the empty glasses.

## The punchline, for fun

The rule is simple: no new round starts until the last glass is washed.

## The options, in plain words

A. A new round when work is picked up after the current round has all closed, in whole minutes, the option built.
B. Read each round from the report the wave leaves on the feature pull request.
C. Show only the planned rounds, and not guess the real ones.

## What I had to decide

How the timeline counts "waves as planned and as merged" and a slice's time. The spec's detector table names both and the median-time finding, but not how waves are recognised in GitHub's data, nor the unit of time. No record says which wave a sub-PR belonged to.

## What I did meanwhile

`wavesAsMerged` in `src/retro/kinds/timeline.mjs`: sub-PRs ordered by opening (the claim); one opened after every sub-PR of the current wave had closed starts the next wave. A slice's time is its sub-PR's opening to its merge, rounded to whole minutes; an unmerged sub-PR has no time. On PRD 50 this gives 2 waves planned and 2 as merged, 13, 20 and 21 minutes, and a median of 20.

## What it costs to change later

One function and its test. Reading waves from the claim commits or the wave's own report instead would need more reads from GitHub in the timeline's gather.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a wave that claims its slices one by one, merging each before claiming the next, should read as one wave; this rule reads it as several.
