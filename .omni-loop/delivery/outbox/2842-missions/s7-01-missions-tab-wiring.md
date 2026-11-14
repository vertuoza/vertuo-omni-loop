---
id: s7-01-missions-tab-wiring
prd: 2842
slice: s7
rank: medium
bears-on: none
raised: 2026-11-14
wave: 5
---

## The question, in plain words

The Missions tab needs to be drawn inside the Fleet page's frame, but that frame lives in a file outside this slice's ground. How should it be wired?

## The decision, in plain words

A small optional slot was added to the Fleet page's frame file so the Missions tab can be shown there, and the page fills it. Nothing else in that file changed.

## The intro, for fun

The Missions tab needed a seat, and the seat was in the next room.

## The punchline, for fun

One optional slot was added, and nobody had to move house.

## The options, in plain words

A. A. An optional slot on the Fleet page frame, filled by the page's own streamed block (built)
B. B. Load the missions inside the fleet board read, as the heroes are, and carry them in the board view
C. C. A separate route for the Missions tab, with no change to the frame

## What I had to decide

Add an optional `missions` slot to FleetScreen (apps/galaxy/src/dashboard/fleet/FleetScreen.tsx) that the Missions tab fills, and have the page (app/app/fleet/page.tsx) stream the tab in its own block, read as the signed-in person. The slice's territory holds the page and the tab, not FleetScreen, so this one-prop edit is outside it. A different answer costs one prop.

## What I did meanwhile

The Missions tab shows in the Fleet page now; every other tab and ordinary fleets are unchanged.

## What it costs to change later

One optional prop and one line in FleetScreen; undone by removing them and loading the missions inside loadFleetBoard instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The tab's progress counts the PRDs of the mission's scope plus any PRD its events name; a roadmap's PRDs count only once the supervisor has met them (author)
- The brief links to the mission's GitHub issue, since no mission page route exists yet (author)
