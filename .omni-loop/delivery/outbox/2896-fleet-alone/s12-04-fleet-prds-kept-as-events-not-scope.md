---
id: s12-04-fleet-prds-kept-as-events-not-scope
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

Where does the app keep the PRDs the fleet added to a mission?

## The decision, in plain words

As entries in the mission's own history, one per PRD added and one per roadmap row the cap left out. The mission's written scope stays as the person wrote it, and the app adds the fleet's PRDs after it each time it reads the mission.

## The intro, for fun

The person's list stays in their handwriting.

## The punchline, for fun

The fleet's additions go in the margin.

## The options, in plain words

A. A. History entries only, the scope left as the person wrote it (built).
B. B. Also append them to the mission's scope.

## What I had to decide

Whether the fleet's PRDs should also be written into the mission's scope, so other readers see them without reading its history.

## What I did meanwhile

Two new kinds of mission event, prd-added and not-written, written by the service role; the supervisor widens the scope from them on every run and the Missions tab reads them.

## What it costs to change later

A database function that appends to missions.scope, and the readers that would then read the scope alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the mission page should list the fleet's PRDs inside the scope rather than on a line of their own.
