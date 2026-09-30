---
id: s1-01-jump-pose-and-pause-exit
prd: 817
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Which picture shows the hero in mid-air, and may B leave the paused game in the arcade as well as SELECT?

## The decision, in plain words

The hero jumps with a fist raised, the cheering pose we already draw, and on the pause screen both B and SELECT go back to the game room.

## The intro, for fun

Every hero needs a jumping face, and ours already knew how to cheer.

## The punchline, for fun

So he cheers his way over every pipe, and B still gets you home.

## The options, in plain words

A. Jump with the cheer pose, and let B or SELECT leave the pause, as built.
B. Jump with the second run stride instead, and let only SELECT leave the pause, exactly as the spec words it.
C. Draw a new jumping pose in the design system in a later slice.

## What I had to decide

The jump frame of the hero, and which buttons leave the pause screen in the arcade.

## What I did meanwhile

The jump frame is the existing cheer pose, and B or SELECT on the pause leaves for the game room; each is one line to change.

## What it costs to change later

One constant in the art and one line in the pause handling, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec names the run pose for the frames but no pose for the jump (author)
- the spec names SELECT for leaving the pause; the dock uses B for going back (author)
