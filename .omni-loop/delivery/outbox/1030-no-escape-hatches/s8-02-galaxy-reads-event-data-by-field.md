---
id: s8-02-galaxy-reads-event-data-by-field
prd: 1030
slice: s8
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The galaxy map used to trust that every stored game event carried exactly the details it expects. Now that it checks them, what does it do with a detail of the wrong kind?

## The decision, in plain words

A detail of the wrong kind is read as missing, a damage mark of a kind the rules do not know is left off the map, and an event of a kind the game does not know still shows in the planet's log but earns no points. Nothing the game writes today is affected.

## The intro, for fun

The galaxy map used to believe every postcard the ledger sent it.

## The punchline, for fun

Now it reads the stamp before it reads the card.

## The options, in plain words

A. Read each field by its type and leave out what does not fit: the option built.
B. Parse every event's data with a strict schema per event type in the package, and throw when one fails, which blanks the whole map on one bad row.
C. Draw an unknown wound kind under a neutral label with no weight, so a new kind shows before the rules name it.

## What I had to decide

What buildGalaxy does with an event's data field of an unexpected type, a WOUND_OPENED of an unknown kind and a ledger row whose type is not one of EVENT_TYPES, once the `e.data as EventData` and `sorted as GameEvent[]` casts are gone; a strict zod parse would have no failure path here, as buildGalaxy has none today.

## What I did meanwhile

Each data field is read with textOf or a number reader, a wrong type reading as absent; a wound whose kind is not in WOUND_KINDS is not drawn (it had no threat weight or decay, so it drew NaN before); score() receives only the rows whose type is a game event type. A test covers each, red on the cast version.

## What it costs to change later

A constant: each reader is one line, and drawing an unknown wound kind again needs a fallback weight for it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec asks for strict zod schemas where outside data comes in; the arcade's ledger read is that boundary (s2's ground), so the package reads defensively rather than parsing twice
