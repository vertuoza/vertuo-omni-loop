---
id: s8-01-room-wiring-and-clean-up
prd: 2842
slice: s8
rank: medium
bears-on: none
raised: 2026-11-14
wave: 6
---

## The question, in plain words

The Operation room needs a seat in the Fleet page's frame, outside this slice's ground, and a clean-up line whose saves belong to a workspace, not to one fleet. How should each be done?

## The decision, in plain words

The room takes a second optional slot in the Fleet page's frame, filled by the page's own streamed block, as the Missions tab does. The clean-up line counts every save the workspace's runners still keep, and the page refreshes itself every 30 seconds so a new row can slide in.

## The intro, for fun

The room needed a window, and the wall was next door's.

## The punchline, for fun

One more slot in the wall, and the ledger found its light.

## The options, in plain words

A. A. A second optional slot on the Fleet page frame, filled by a streamed block (built)
B. B. Load the room inside the fleet board read and carry it in the board view
C. C. Count only the saves of jobs the fleet's missions sent, for the clean-up line

## What I had to decide

Add an optional `room` slot to FleetScreen (apps/galaxy/src/dashboard/fleet/FleetScreen.tsx) and have the page (app/app/fleet/page.tsx) stream the room in its own block. Both files are outside the slice's territory. Saves record their workspace and job, not a fleet, so the clean-up line is the workspace's; the Reviewer seat reads `A person does this today` because its skill is not built.

## What I did meanwhile

The Operation room shows on a virtual fleet's default tab; every other tab and ordinary fleets are unchanged.

## What it costs to change later

One optional prop and a few lines in FleetScreen; the clean-up line moves to a fleet's saves with one join on the jobs' mission.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the clean-up line shows the workspace's saves or the fleet's only (the screen's open question on the ledger's scope is the same)
- How long the ledger keeps rows: it reads the 200 newest events of the fleet's missions
