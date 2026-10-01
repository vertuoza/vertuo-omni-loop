---
id: s23-02-demo-regions-carry-no-feature-pr
prd: 725
slice: s23
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The demo world's raw snapshot now says outright that each repository has no feature pull request of its own, where it used to leave that unsaid. Is that acceptable?

## The decision, in plain words

Yes for now: the game already reads a missing value and an empty one the same way, so the demo's events, galaxy and points are identical before and after.

## The intro, for fun

The demo planets filled in a blank on their paperwork that nobody ever read.

## The punchline, for fun

Same planets, same points, one extra 'none' in the margin.

## The options, in plain words

A. The demo says each repository has no feature pull request of its own, as the game's shape asks (built).
B. Let the game's shape leave that value out, and leave the demo as it was.

## What I had to decide

Whether demoSnapshot's regions may carry featurePr: null, which the game's Snapshot type requires, or whether the game's Region type should make featurePr optional instead.

## What I did meanwhile

demoSnapshot writes featurePr: null on every region. Nothing outside the package reads demoSnapshot; demoEvents, buildGalaxy and borrowedXp were compared as JSON at three dates and are identical.

## What it costs to change later

A constant: drop the field from the demo and make Region.featurePr optional in game/types.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) demoSnapshot's JSON grows by the added field, about 300 bytes; no caller reads it today.
