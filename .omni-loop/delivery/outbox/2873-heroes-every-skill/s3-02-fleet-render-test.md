---
id: s3-02-fleet-render-test
prd: 2873
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

May this slice change a test of the Fleet page that sits outside its ground, when that test still expects the old words on the Heroes tab?

## The decision, in plain words

Yes, the least it takes: two of that test's checks now expect the count line, each skill's mark and the sixth role. The new checks of every role's skills sit in a test file of the slice's own.

## The intro, for fun

An old test was still waiting for words this PRD retires.

## The punchline, for fun

It got two lines of news and kept everything else it knew.

## The options, in plain words

A. Edit the two checks in place (built).
B. Move every Heroes tab check from the Fleet page's test into the slice's own test file.

## What I had to decide

Keep the two edited checks, or move the Heroes tab's checks out of the Fleet page's test into the slice's own file.

## What I did meanwhile

Built A: apps/galaxy/src/dashboard/fleet/heroes.render.test.ts has two checks updated (the Engineer and PM lines, and the roles that fill a fleet); apps/galaxy/src/virtual-fleets/heroes/heroes.render.test.ts holds the new checks.

## What it costs to change later

A constant: two test lines, no product code outside the slice's ground.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s3 names apps/galaxy/src/virtual-fleets/ but not the Fleet page's test of the Heroes tab, which would fail otherwise.
