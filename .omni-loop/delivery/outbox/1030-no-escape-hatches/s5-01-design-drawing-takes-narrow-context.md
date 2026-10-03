---
id: s5-01-design-drawing-takes-narrow-context
prd: 1030
slice: s5
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The home page draws the planet and the stars on the server with stand-ins for a drawing surface, which the shared drawing library only took with a forced type. Where should that be fixed?

## The decision, in plain words

The shared drawing library now asks only for the two or three drawing calls it really makes, so the home page's stand-ins fit without forcing anything. That library sits in another slice's area of the plan.

## The intro, for fun

A planet drawn on a server has to borrow a canvas that does not exist.

## The punchline, for fun

Now the library only asks for the brush it actually uses.

## The options, in plain words

A. A. Narrow the two parameters in the design package from this slice: the option built.
B. B. Leave the package alone and have the packages slice narrow them, keeping a cast on the poster until then.
C. C. Copy the planet and starfield drawing into the home page so it owns its own types, at the price of two copies of the same drawing.

## What I had to decide

Whether this slice may narrow the parameter types of drawPlanet and drawStarfield in the shared design package, a folder the plan gives to the packages slice, so the home poster's stand-ins need no cast.

## What I did meanwhile

drawPlanet now takes a context with only drawImage, and drawStarfield one with only fillStyle and fillRect. Every real canvas context still fits; nothing else in the package changed, and the file had no ts-allow line for the packages slice to clear.

## What it costs to change later

Two parameter types in one file; going back is two lines, plus the casts on the poster.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan's territory for this slice does not list the design package, and the packages slice may touch the same file in the same wave
