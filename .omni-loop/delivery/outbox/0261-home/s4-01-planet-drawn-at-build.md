---
id: s4-01-planet-drawn-at-build
prd: 261
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The poster's planet should show green ground spreading across it. Should it be animated live in the visitor's browser, or drawn ahead of time so the page needs no extra code to show it?

## The decision, in plain words

The planet is drawn once when the site is built, by the game's own planet painter, as three pictures that take turns so the green visibly spreads. The page keeps a single small interactive part, as the spec asks.

## The intro, for fun

A planet walks into a static page and asks for a script.

## The punchline, for fun

It got three still frames and a flipbook instead.

## The options, in plain words

A. A: Three frames drawn when the site is built, taking turns with no script (built).
B. B: A small live canvas that turns the planet and spreads the green smoothly, as a second client part.
C. C: A single still frame, half secured, with no motion at all.

## What I had to decide

Whether the invasion on the poster's planet may stay a three-frame loop, or should turn smoothly in the browser like the arcade's planets.

## What I did meanwhile

HOME shows the three frames in turn, and only the last one for visitors who asked for less motion.

## What it costs to change later

Small: the frames live in one file of the poster, and a live canvas would be one more small client part in their place.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No one was asked whether a second client part for the planet would break the spec's rule of one interactive component; the builder read the rule strictly. (author)
