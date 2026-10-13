---
id: s7-01-stand-ship-look
prd: 1775
slice: s7
rank: medium
bears-on: none
raised: 2026-10-13
wave: 3
---

## The question, in plain words

The spec says each stand shows a fleet's ship drawn with its mascot and colour, but there is no ship drawing per fleet. What should a stand show?

## The decision, in plain words

Each stand shows the fleet's mascot standing on a small platform lit in the fleet's colour; with no fleet, the neutral ship stands there instead.

## The intro, for fun

The grandstands are built, but nobody drew the spectators a ticket.

## The punchline, for fun

For now every fleet cheers from its own lit platform.

## The options, in plain words

A. A. The fleet's mascot on a platform lit in the fleet's colour
B. B. A dedicated starship sprite tinted in the fleet's colour, with the mascot in its window
C. C. The neutral ship on every stand, tinted in the fleet's colour

## What I had to decide

A person picks whether stands should show a dedicated ship drawing per fleet, tinted in the fleet's colour, instead of the mascot on a platform.

## What I did meanwhile

Stands show the mascot on a platform in the fleet's colour, and the neutral ship with no fleet.

## What it costs to change later

A new sprite per look and a change to one drawing function; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say which sprite a fleet's ship is (author)
