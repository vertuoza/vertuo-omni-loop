---
id: s3-03-switch-tests-outside-territory
prd: 1830
slice: s3
rank: medium
bears-on: none
raised: 2026-10-13
wave: 2
---

## The question, in plain words

Two older checks that list every entry of the app's menu sat outside the part of the code this slice was given, and they failed once the Runners entry was added. Should this slice update them?

## The decision, in plain words

Both checks were updated to expect the new Runners entry after Loop, and nothing else in them changed.

## The intro, for fun

The new room got its door sign, and the fire map by the lift still showed the old floor plan.

## The punchline, for fun

We drew the new room on the map rather than take the room away.

## The options, in plain words

A. A. The two lists updated in this slice, as built.
B. B. The two lists updated by the wave after merging, and this slice left red until then.

## What I had to decide

Accept the two one-line test updates outside the slice's area, or move them to another slice.

## What I did meanwhile

apps/galaxy/src/switch/headers.test.ts and apps/galaxy/src/switch/switch.test.ts each gain Runners (/app/runners) after Loop in the list of the sidebar's entries they expect; no other line changes.

## What it costs to change later

Nothing: two expected lists in tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names only the sidebar's own tests under s3's area; these two also list the menu's entries.
