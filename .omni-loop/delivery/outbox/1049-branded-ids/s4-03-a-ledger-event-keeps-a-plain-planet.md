---
id: s4-03-a-ledger-event-keeps-a-plain-planet
prd: 1049
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 3
---

## The question, in plain words

Every event in the game's permanent history names its planet by its PRD number, under the name planet. Should that number carry the new PRD type too?

## The decision, in plain words

Not yet: an event's planet stays a plain number, since the arcade builds events itself. The galaxy turns it into a PRD number where it makes a planet of it.

## The intro, for fun

Every planet in the history book is filed under a plain number.

## The punchline, for fun

The librarian checks its badge only at the door of the galaxy.

## The options, in plain words

A. A. Leave planet plain; the galaxy parses it where a planet is made (built).
B. B. Brand the event's planet now, and have s5 or s6 update the arcade's event builder.

## What I had to decide

Whether a ledger event's `planet`, a credit's `planet` and a contributions row's `number` (a PRD or a pull request) take a brand, though s6's guard does not police those names.

## What I did meanwhile

They stay plain numbers. packages/galaxy parses the event's planet into a PrdNumber where it derives a planet (buildGalaxy), so the galaxy view's Planet.prd is branded; the arcade's ledger reader (apps/galaxy load-galaxy.ts) builds events with a plain planet and is outside this slice.

## What it costs to change later

Branding them later is a type change in game/events.ts and packages/galaxy/src/types.ts plus the arcade's event builder; the stored ledger is unchanged, since the schema already refuses anything but a positive whole number.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan brands ID-named fields and GitHub's `number`; it does not say whether a field holding an ID under another name (`planet`) is in scope.
