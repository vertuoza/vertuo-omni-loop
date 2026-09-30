---
id: s3-01-dock-plays-silent
prd: 757
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Should the little game on a PRD's page make the arcade's sounds, or stay quiet?

## The decision, in plain words

It stays quiet. A page people read and work on is not the arcade, so the game plays with no music and no sound effects.

## The intro, for fun

A space battle on a work page raises one question: do the aliens get to go pew?

## The punchline, for fun

For now they fight in polite silence, like a library with lasers.

## The options, in plain words

A. Play silent, as built.
B. Play the arcade's sounds, with the arcade's mute key M.
C. Play silent by default, with a sound button on the device.

## What I had to decide

Whether the play dock plays the arcade's march and sound effects, or plays silent.

## What I did meanwhile

Silent: the dock never calls the arcade's sound module. Turning sound on later is a few calls in one file, no stored data.

## What it costs to change later

A few lines in the dock's game file, and a way to mute it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether players miss the sound when they play on the page (author)
