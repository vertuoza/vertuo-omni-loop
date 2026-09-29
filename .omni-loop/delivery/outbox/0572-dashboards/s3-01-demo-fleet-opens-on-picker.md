---
id: s3-01-demo-fleet-opens-on-picker
prd: 572
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

In the demo, the visitor plays without a fleet. Should the Fleet page open on the list of fleets to pick from, or straight on one fleet's board?

## The decision, in plain words

The demo Fleet page opens on the list of fleets with the line asking to pick one, exactly as a real member without a fleet sees it; one click shows a full board.

## The intro, for fun

The demo visitor walks in with no team shirt on.

## The punchline, for fun

So the page hands them the whole rack to choose from.

## The options, in plain words

A. Open on the list of fleets, as a member without a fleet sees it.
B. Open straight on the first demo fleet's board.
C. Make the demo visitor a member of a demo fleet, on every page.

## What I had to decide

Whether /app/fleet in the demo, with no ?fleet, shows the picker (the demo you, DAM-DEV, plays solo) or defaults to a demo fleet's board so every part shows without a click.

## What I did meanwhile

demoFleetBoard follows the same rule as a real member: the demo you is solo, so with no ?fleet the page shows the picker and 'Pick a fleet to see its board'; ?fleet=builders shows every part of the board.

## What it costs to change later

One default in demoFleetBoard (src/dashboard/fleet/fleet.ts) and its render test; no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the demo is meant to show every part of every page with no click at all (author)
