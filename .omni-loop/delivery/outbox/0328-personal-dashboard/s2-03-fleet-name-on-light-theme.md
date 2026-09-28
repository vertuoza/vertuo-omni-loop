---
id: s2-03-fleet-name-on-light-theme
prd: 328
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The spec shows the fleet's name in the fleet's own colour. On the light theme a pale fleet colour, such as yellow, cannot be read on a white page: what should the name look like there?

## The decision, in plain words

The name is written in the fleet's colour on the Omni and dark themes. On the light theme it is written in the normal text colour, and a small square in the fleet's colour sits beside it on every theme.

## The intro, for fun

Yellow on white is technically a colour, and practically invisible.

## The punchline, for fun

So the light theme gets a little coloured square to carry the fleet's colours for it.

## The options, in plain words

A. A: the fleet's colour on the dark themes, ink with a colour square on light, the option built.
B. B: the name in the fleet's colour on every theme, as the spec reads, pale fleets hard to read on light.
C. C: the name always in ink, and the colour square alone carrying the fleet's colour.

## What I had to decide

How the fleet's name keeps its colour and stays readable on each of the three themes.

## What I did meanwhile

A square in the fleet colour beside the name on every theme; the name itself in the fleet colour on Omni and Dark, and in the ink colour on Light.

## What it costs to change later

Two lines of the dashboard's stylesheet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether every fleet colour reaches readable contrast on the Omni and dark grounds was not measured (author)
