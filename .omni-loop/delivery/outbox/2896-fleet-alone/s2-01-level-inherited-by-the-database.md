---
id: s2-01-level-inherited-by-the-database
prd: 2896
slice: s2
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

A mission's brief may leave its level out. Who fills it in with the fleet's level: the skill that writes the brief, or the database when the brief is stored?

## The decision, in plain words

The database fills it in from the fleet when the brief names none, so a mission is never left without a level. The skill writes the level when it is told one, and otherwise the brief reads Reviews with you until the database stores it.

## The intro, for fun

A form left blank still gets a name on the door.

## The punchline, for fun

Better a default written down than a guess made later.

## The options, in plain words

A. A. The database fills the level in from the fleet (built).
B. B. The skill reads the fleet's level and writes it, with a new command and route.

## What I had to decide

Whether the skill must read the fleet's level itself, which needs a new way for the kit to read a fleet from the Omni page.

## What I did meanwhile

The database trigger takes the fleet's level when the brief has none, and the Missions tab shows the level the database stored.

## What it costs to change later

Reading the level in the skill later costs one command and one route; the trigger can stay as the fallback.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The kit has no command that reads a fleet from the Omni page, and the territory names none (author).
