---
id: s5-01-bugs-route-outside-territory
prd: 3001
slice: s5
rank: medium
bears-on: none
raised: 2026-11-17
wave: 3
---

## The question, in plain words

A person's pick on Decide the bugs needs a web address of its own to send it to, and the slice's territory holds no file for one. Is a five-line route file outside the territory acceptable?

## The decision, in plain words

The route file for the pick was added beside the existing start, pause, resume and level routes; all its logic stays inside the missions folder.

## The intro, for fun

The two buttons needed a door, and the plan forgot to build one.

## The punchline, for fun

It is the same door every sibling route already uses.

## The options, in plain words

A. A. Keep the route file where the other mission routes are.
B. B. Move the route under the missions folder and mount it from elsewhere in a later slice.

## What I had to decide

Build the route as the four sibling routes are built, calling pickBugs of the missions controller (apps/galaxy/app/api/missions/[id]/bugs/route.ts).

## What I did meanwhile

The route exists and is tested through the controller; nothing else outside the territory changed.

## What it costs to change later

Deleting one file and its call removes the pick.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the plan meant the route to belong to this slice's territory
