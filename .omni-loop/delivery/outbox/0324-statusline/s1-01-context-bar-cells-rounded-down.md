---
id: s1-01-context-bar-cells-rounded-down
prd: 324
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The example line in the spec draws six filled cells for 58 %, while its rule, one filled cell for each whole 10 %, gives five. Which one should the context bar follow?

## The decision, in plain words

The bar follows the rule: one filled cell for each whole 10 %, so 58 % fills five cells out of ten. The example line is read as drawn by hand.

## The intro, for fun

The spec drew the bar's rule with a ruler, then sketched its example freehand.

## The punchline, for fun

Fifty-eight now fills five cells, exactly as the rule counts them.

## The options, in plain words

A. Round down, one filled cell for each whole 10 %, as the rule and the plan's list say: 58 % fills five cells. The option built.
B. Round to the nearest cell, as the example draws it: 58 % fills six cells, but then 49 % fills five and 79 % fills eight, against the plan's list.

## What I had to decide

Whether the context bar fills one cell per whole 10 % (the spec's rule, and the plan's list of cells at 0, 49, 50, 79, 80, 100 and 130 %), or rounds to the nearest cell, as the spec's and the plan's example line `██████░░░░ 58%` draws it.

## What I did meanwhile

The bar rounds down: 0, 49, 50, 79, 80, 100 and 130 % fill 0, 4, 5, 7, 8, 10 and 10 cells, as the plan's done-when lists them, and 58.9 % fills five. The done-when's expected line is asserted with five cells, `█████░░░░░ 58%`, not the six its example draws.

## What it costs to change later

One expression in `kit/lib/statusline/render.mjs` and the expected cells in its tests and in `kit/bin/statusline.test.mjs`. No stored data, and no other slice depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's example line and its rule disagree, and the plan's done-when repeats the example line while also listing the cells the rule gives; nothing says which one wins.
