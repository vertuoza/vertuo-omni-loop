---
id: s9-01-upright-map-planets-in-lanes
prd: 94
slice: s9
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

On a phone held upright the galaxy map has half the width it had, so the planets cannot sit where they sat. How should they be arranged, and how big should they be?

## The decision, in plain words

Each sector keeps its own column, as before, and its planets step down it in two or three slanted lines, with room above each for its little status picture. All planets shrink by the same amount, so a bigger planet still means a bigger project.

## The intro, for fun

Twelve planets, one phone held upright, and every one of them wants a window seat.

## The punchline, for fun

So they queue down their columns like passengers boarding by rows.

## The options, in plain words

A. Each sector keeps its column, its planets step down it in slanted lines with room for their status pictures, all shrunk by the same amount. This is what was built.
B. Stack the sectors as rows across the whole width, each sector's planets side by side in one line.
C. Draw the planets bigger and let a status picture overlap the planet above it where the column is crowded.

## What I had to decide

The spec asks that the tall map keep every planet inside 320×288 and apart, that the D-pad reach every planet, and that the sectors, the hyperlanes, the distress pulses and the dialog all show. It does not say how the planets are arranged on the tall grid, nor how big they are drawn.

## What I did meanwhile

`layoutMap(view, TALL)` in `apps/galaxy/src/arcade/scenes/map.ts` keeps each sector's column and zigzags its planets down it in lanes: planet j sits in lane j % lanes, one step lower than planet j - 1. Each planet owns a box its lane wide, with 22 grid px at its top for the state icon, so no two planets overlap and no icon lands on another planet. One shrink factor for the whole map, set by the most crowded sector, keeps sizes by class: on the demo galaxy a class I planet has a radius of 9 grid px, II 11 and III 14, against 14, 18 and 22 on the wide grid (on a 393 px phone that is still larger on screen than today's letterboxed map). The planets stay 10 px from the grid's outer edges so the selection's brackets stay on screen. `neighbour` is unchanged. `scenes/map.test.ts` pins the properties on the demo galaxy and on four made-up ones.

## What it costs to change later

A constant or a function: the tall branch of `layoutMap()` and its constants (`TALL_MAP`, the lane count, the edge margin) in one file, with its tests. The wide layout, the stored data and the D-pad's rule do not move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether players find a planet faster in slanted lines or in a plain grid: nobody has played it on a phone yet.
- (author) The real galaxy's sectors and planet counts: checked on the demo galaxy and four made-up ones only.
