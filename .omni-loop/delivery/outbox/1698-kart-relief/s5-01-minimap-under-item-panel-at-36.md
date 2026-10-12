---
id: s5-01-minimap-under-item-panel-at-36
prd: 1698
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 4
---

## The question, in plain words

The item panel is drawn by the page, not the canvas, so the game does not know how tall it is. Where should the minimap start under it?

## The decision, in plain words

The minimap starts 36 game pixels from the top, just under the panel as it is today, 8 pixels in from the right edge.

## The intro, for fun

The minimap needs a seat, and the item panel will not say how tall it sits.

## The punchline, for fun

We guessed 36 and left a constant to change.

## The options, in plain words

A. A. Fixed at 36 from the top (built)
B. B. Measured from the page's panel at run time, which couples the canvas to the page

## What I had to decide

Read the panel's height from its stylesheet: the top is 8 and the box is about 24 high, so 36 clears it on both grids. One constant, MINIMAP_TOP in art.ts, moves it.

## What I did meanwhile

The minimap sits at 36 from the top on both grids.

## What it costs to change later

A taller item panel would overlap it until the constant is raised.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The panel's real rendered height on a phone (author)
