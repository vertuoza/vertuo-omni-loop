---
id: s1-01-arcade-leaves-out-virtual-fleets
prd: 2842
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

How does the arcade stop offering a virtual fleet to players, when the code that lists the arcade's fleets sits outside what this slice may change?

## The decision, in plain words

I changed the two lines that read the arcade's fleets so they leave virtual fleets out, and the database also refuses a player who tries to join one. Settings and the Fleet section still list them.

## The intro, for fun

A fleet of agents walked into the arcade and asked for a joystick.

## The punchline, for fun

The arcade checked its list, and the agents were not on it.

## The options, in plain words

A. A. The arcade's read leaves virtual fleets out, and the database refuses a player in one (built).
B. B. A database view of the players' fleets that every arcade read uses instead.
C. C. Only the database refusal: the select screen may still show a virtual fleet, and joining it fails.

## What I had to decide

Keep the arcade's read filtered (A), or move the filter into the database so no app code has to remember it (B).

## What I did meanwhile

The arcade's select screen lists only players' fleets; the database refuses a player in a virtual fleet whatever the screen shows.

## What it costs to change later

Small either way: B is one database view and a change of the arcade's read to it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The change is outside the slice's territory: apps/galaxy/src/data/load-galaxy.ts (loadFleets takes `players`) and apps/galaxy/src/data/arcade.ts (passes it). No other slice of the plan touches either file. (author)
- The season's fleet ranking and the galaxy view still read every fleet, so a virtual fleet shows there with no points; nothing in the spec says whether it should. (author)
