---
id: s8-04-two-files-outside-the-territory
prd: 1364
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

The slice had to touch two files its plan row does not list. Is that all right?

## The decision, in plain words

Yes: the list of known layering breaches lives at the repository's root, not under the app, and a header test elsewhere lists every sidebar entry, so both had to change for the checks to stay green.

## The intro, for fun

The map said the treasure was under the app, but it was buried at the root.

## The punchline, for fun

So the shovel went where the treasure actually was.

## The options, in plain words

A. Edit both files in this slice, the option built.
B. Leave the settings page's product read as it was so the list of breaches does not change, and leave the header test to another slice.

## What I had to decide

Whether to change layering/baseline.json and apps/galaxy/src/switch/headers.test.ts, outside the row's territory.

## What I did meanwhile

Removed the load.ts database-call line from layering/baseline.json (the plan names apps/galaxy/layering/baseline.json, which does not exist) and added Products to the sidebar list in apps/galaxy/src/switch/headers.test.ts.

## What it costs to change later

Nothing to undo: both edits only follow the code this slice changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the plan's territory path for the baseline should be corrected for s11
