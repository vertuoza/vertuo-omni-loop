---
id: s3-02-runners-sprite
prd: 1830
slice: s3
rank: medium
bears-on: none
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The new Runners entry in the menu needs its own small picture, and drawing a new one belongs to the design package, which this slice may not change. Which picture should it show?

## The decision, in plain words

The Runners entry shows the game's existing item box picture, a box things come out of, until someone draws a picture of its own.

## The intro, for fun

Every room in the station has a little sign on its door.

## The punchline, for fun

The new room borrowed the prize box sign until the painter gets back.

## The options, in plain words

A. A. The existing item box sprite, as built.
B. B. A new small menu picture drawn for Runners in the design package, in a later change.
C. C. The Loop sprite again, since runners sit beside the loop.

## What I had to decide

Keep the item box picture for the Runners entry, or draw a new menu picture for it in the design package.

## What I did meanwhile

apps/galaxy/src/nav/sidebar.ts gives the runners entry the sprite 'item-box', an existing 16x16 sprite of @omni/design, as Products uses 'coin' and Ideas 'tile-block'. The sidebar tests name it.

## What it costs to change later

One constant in apps/galaxy/src/nav/sidebar.ts and its test, once a new sprite exists in packages/design/src/sprites.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'with its sprite' and names no picture; packages/design is outside s3's territory, so no new sprite could be drawn here.
