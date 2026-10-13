---
id: s5-01-walkway-on-the-grid
prd: 1829
slice: s5
rank: medium
bears-on: none
raised: 2026-10-13
wave: 3
---

## The question, in plain words

A ramp only fits on a whole tile of road, and the walkway is now one tile wide. Should the walkway sit exactly on the tile grid, two tiles south of the top straight, instead of a little closer?

## The decision, in plain words

The walkway now lies on the middle of a tile row, two tiles south of the top straight's axis instead of a little under two, so its ramp is a whole tile of road. Its gap is calibrated so that full speed clears it and nine tenths of it does not.

## The intro, for fun

A one-tile walkway is a tightrope, and the ramp wants a whole tile of it.

## The punchline, for fun

So the rope moved a fifth of a tile to stand on the grid.

## The options, in plain words

A. A. Walkway on the grid, two tiles off the straight, ramp on a whole tile (built)
B. B. Keep the closer position and let the ramp check accept a ramp only partly on road
C. C. Keep the closer position with the ramp on the arc, before the walkway starts

## What I had to decide

The spec says about 1.8 tiles; the ramp check wants every corner of its tile on road, which a one-tile walkway only offers when it lies on the grid. 2.0 is the nearest such position. Changing it is one constant plus a re-measure of the gap.

## What I did meanwhile

The walkway sits 2.0 tiles off the top straight's axis, with its ramp at column 33 and a gap of 3.35 tiles.

## What it costs to change later

Moving it back to 1.8 means a ramp that is not a whole tile of road, so the ramp check would have to accept partial tiles.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Why 1.8 rather than 2.0 was written in the spec (author)
