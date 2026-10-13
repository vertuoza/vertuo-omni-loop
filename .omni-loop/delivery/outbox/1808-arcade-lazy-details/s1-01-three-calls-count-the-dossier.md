---
id: s1-01-three-calls-count-the-dossier
prd: 1808
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

Opening a planet must cost at most three database calls. Does that limit cover only reading the planet's dossier, or also finding the planet and its log?

## The decision, in plain words

The dossier is read in three calls. Finding the planet and its log reuses the map's saved copy, which still asks the database four small questions to know the copy is current.

## The intro, for fun

Three calls sounded like a budget, until the planet had to be found first.

## The punchline, for fun

The dossier kept to its three; the map's checks came along for the ride.

## The options, in plain words

A. A. The limit covers the dossier: three calls for it, and the map's usual checks to find the planet and its log.
B. B. The limit covers the whole answer: one database function returns everything, at the price of a migration.

## What I had to decide

Whether the three-call limit covers the dossier only, as built, or the whole answer.

## What I did meanwhile

Each opened planet makes three dossier calls plus the four small checks the map's saved copy makes on every page, far from the 430 calls a page load made before.

## What it costs to change later

Option B needs a new database function that returns the workspace, the planet's log and its dossier at once: a migration, and a second copy of how the log is built.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How long the four extra calls take on production is not measured yet (author).
