---
id: s3-01-up-moves-in-down-moves-out
prd: 149
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

In a system, the up and down buttons change orbit. Which one moves toward the sun, and which one away from it?

## The decision, in plain words

Up moves one orbit in, toward the sun, and down moves one orbit out, the same order the panel and the page's index read: principles first, then rules, then invariants.

## The intro, for fun

A solar system has no up or down, but a game pad insists on having both.

## The punchline, for fun

So up means toward the sun, the way every good story about stars begins.

## The options, in plain words

A. Up moves in, toward the sun; down moves out, the option built.
B. Up moves out, away from the sun; down moves in.
C. Up and down move to the next world in that direction on the screen, whatever its orbit.

## What I had to decide

The spec says ▲ and ▼ move to the planet on the next orbit in or out that is nearest in angle, but not which button goes which way. On screen neither reading is spatial: a world at the top of its orbit moves up to go out, one at the bottom moves up to go in.

## What I did meanwhile

▲ moves to the next orbit in and ▼ to the next orbit out, skipping an empty orbit, each to the world nearest in angle; at the innermost or outermost orbit the press does nothing. `orbitStep` in apps/galaxy/src/arcade/scenes/chart-layout.ts holds the mapping, the README says it, and chart-layout.test.ts pins it.

## What it costs to change later

Swapping the two is one sign in `orbitStep` and two words in the README and the scene's hint. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names both directions without mapping them to the two buttons.
