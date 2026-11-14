---
id: s3-01-s3-help-guide-ground
prd: 2842
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 3
---

## The question, in plain words

The mission skill needed a few edits just outside its slice's listed folders so the help list, the docs guide and their tests stay green. Is that fine?

## The decision, in plain words

I added the mission skill to the help list, gave the guide its Missions page in the sidebar order, and updated the counts in the tests that check those lists, because those tests fail otherwise.

## The intro, for fun

A new skill walked into the help list and asked for a chair.

## The punchline, for fun

The tests counted the chairs and insisted on one more.

## The options, in plain words

A. A. Keep the edits as built: the lists and tests name the new skill and page.
B. B. Move the list edits into a slice that owns the help list and the guide, and ship the skill alone.

## What I had to decide

Edited kit/lib/help/entries.ts (a mission entry in the Start group), docs/guide/meta.json, and the counts and orders in kit/lib/help/entries.test.ts, apps/galaxy/src/docs/guide.test.ts, docs.test.ts and skills.test.ts. Also chose the docs branch shape mission/<nnnn>-<slug> (no config key names one) and made the fleet's key the one question the one-line form asks, since no omni command lists a workspace's Virtual Fleets yet.

## What I did meanwhile

Nothing waits on this: the slice builds, and a different answer undoes the edits.

## What it costs to change later

A few lines of list and count edits in files outside the slice's folders.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan's help territory meant the help list (kit/lib/help/entries.ts) rather than the help skill folder (author)
- Whether a fleet-listing command should exist for the skill to read the only fleet (author)
