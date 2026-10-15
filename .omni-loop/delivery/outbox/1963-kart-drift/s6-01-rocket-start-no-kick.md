---
id: s6-01-rocket-start-no-kick
prd: 1963
slice: s6
rank: medium
bears-on: none
raised: 2026-10-15
wave: 4
---

## The question, in plain words

A rocket start gives the same boost as an item, yet a kart standing still speeds up too slowly for that boost to show in under a second. Should the rocket start also give the kart a push?

## The decision, in plain words

We built the rocket start as the spec says: the boost for under a second and TURBO under GO. A boost only raises the top speed, so from rest you cannot feel it.

## The intro, for fun

The rocket is lit, but the kart is still looking for the pedal.

## The punchline, for fun

Say whether the rocket gets a real kick.

## The options, in plain words

A. A. Keep the rocket start as the spec says: the boost only, no kick.
B. B. Give a rocket start a starting speed (a share of the top speed) so the kart really shoots off at GO.

## What I had to decide

The spec names the rocket start as today's BOOST for 0.8 seconds with no new speed factor, so RULES.rocketTime sets fx.boost at GO and nothing else; a different kick (a starting speed or a stronger acceleration) is a new number the spec does not give.
Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

A rocket start shows TURBO and a boost trail but the kart leaves the line as fast as a normal start.

## What it costs to change later

Adding a kick later is one constant and a line at GO in race.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How strong the kick should be, in speed or in seconds gained (author)
