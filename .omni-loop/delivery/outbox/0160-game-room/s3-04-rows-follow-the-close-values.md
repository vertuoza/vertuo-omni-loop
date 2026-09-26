---
id: s3-04-rows-follow-the-close-values
prd: 160
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

Each row of aliens is one kind of Entropy, the kind that pays most on top. If someone later changes what each kind pays, should the rows change order?

## The decision, in plain words

Yes: the rows are sorted by what each kind pays, highest on top, so the top row always pays most. Today's values give exactly the order in the design.

## The intro, for fun

In every arcade, the aliens at the top of the screen are the ones worth the most.

## The punchline, for fun

Ours keep that promise even if the rulebook reshuffles the prices.

## The options, in plain words

A. Sort the rows by what each kind pays, highest on top, the option built.
B. Keep the design's row order whatever the values become.

## What I had to decide

The spec lists the rows top to bottom (beacon 25, fault line 20, unconfirmed ground 15, zone under fire 10, transmission 5) and the person asked that the top row pay most. It does not say which wins when a rule change reorders the values.

## What I did meanwhile

`rowKinds()` in `apps/galaxy/src/arcade/games/invaders.ts` sorts the five kinds by the view's `woundClose`, highest first, a tie kept in the spec's order; the score table reads the same order. `games/invaders.test.ts` checks today's order and a reordered one.

## What it costs to change later

Low: one sort to swap for the fixed list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the colours of the rows matter more to the person than which row pays most.
