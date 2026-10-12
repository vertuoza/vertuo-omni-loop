---
id: s1-01-route-move-outside-territory
prd: 1705
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Moving the sign-in pages into their own folder also meant updating two checks the plan did not list for this step: one that confirms every menu entry opens a real page, and the list of known structure exceptions. Is it fine that this step changed them?

## The decision, in plain words

Both were updated only so they find the same pages at their new place. No check was loosened and no exception was added.

## The intro, for fun

Two pages moved house, and two checklists needed the new address.

## The punchline, for fun

Nobody new moved in; the post just goes to the right door now.

## The options, in plain words

A. Keep the updates in this slice: the two checks follow the move in the same change that makes it.
B. Move them to their own slice: revert them here and add a slice whose territory holds them; the build is red in between.

## What I had to decide

Keep the two updates (A), or have the plan list them for a follow-up slice (B).

## What I did meanwhile

The checks pass with the new paths; the feature branch stays green.

## What it costs to change later

None to keep. Undoing means a red build until the paths are fixed elsewhere.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 missed apps/galaxy/src/switch/switch.test.ts and layering/baseline.json (author)
