---
id: s2-01-kart-three-views
prd: 1359
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The spec says the kart is drawn leaning left and leaning right, but a kart driving straight needs a picture too. What does it show?

## The decision, in plain words

The kart gets a third picture, driving straight, next to the left and right leans, so a kart that is not turning does not look like it is turning.

## The intro, for fun

A kart that always leans looks like it is late for every corner.

## The punchline, for fun

So it now has a straight face too.

## The options, in plain words

A. A. Three views: straight, left and right (built).
B. B. Two views only, as the spec reads: the kart keeps the last lean it had, or leans left at the start.

## What I had to decide

The kart has three views, each with two frames: straight, leaning left and leaning right. Straight is shown when no turn is held. Dropping the straight view later is one sprite and one line, and the other two keep their digests.

## What I did meanwhile

The player's kart leans only while a turn is held.

## What it costs to change later

One more forged sprite with a recorded digest.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person prefers the straight view is a matter of taste (author).
