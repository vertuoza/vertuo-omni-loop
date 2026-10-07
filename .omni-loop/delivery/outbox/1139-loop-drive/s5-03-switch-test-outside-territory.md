---
id: s5-03-switch-test-outside-territory
prd: 1139
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Adding the Loop entry to the menu also changed a test that lists every menu entry, in a file the plan had not given this part. Is that change fine here?

## The decision, in plain words

The slice added the Loop page's address to that test's list, the one change needed to keep it true, and nothing else in that file.

## The intro, for fun

Hang a new picture in the hall and the inventory list needs one more line.

## The punchline, for fun

The line was added; no other picture moved.

## The options, in plain words

A. Keep the one-line change in this slice
B. Move it into a separate change outside the slice

## What I had to decide

Whether `apps/galaxy/src/switch/switch.test.ts`, outside s5's territory, may carry the one added `/app/loop` path.

## What I did meanwhile

It does: one path added to the expected list of sidebar entries, which the test checks each open a page that exists.

## What it costs to change later

A constant: one line of a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan listed `apps/galaxy/src/switch/headers.test.ts` but not its sibling `switch.test.ts`, which lists the same entries
