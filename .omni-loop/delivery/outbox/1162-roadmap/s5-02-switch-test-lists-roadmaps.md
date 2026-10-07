---
id: s5-02-switch-test-lists-roadmaps
prd: 1162
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Adding the Roadmaps entry broke a check that lists every menu entry, in a file outside this slice's list. Fix it here, or leave it failing?

## The decision, in plain words

The check now lists the Roadmaps entry too. It is a one-line change to a test, made in this slice so everything stays green.

## The intro, for fun

One new menu entry, and a test somewhere was keeping count.

## The punchline, for fun

It now counts one more.

## The options, in plain words

A. A. Update the test's list in this slice
B. B. Leave it failing for a later slice to fix

## What I had to decide

`apps/galaxy/src/switch/switch.test.ts` pins the sidebar's in-app paths and checks each page exists. The plan gave s5 `headers.test.ts` but not this file; the Roadmaps entry makes it fail until `/roadmaps` is in its list.

## What I did meanwhile

Added `/roadmaps` between `/app/engineering` and `/prd` in that test's expected list; `app/roadmaps/page.tsx` exists, so its page check passes.

## What it costs to change later

None: a test's expected list. Reverting the entry reverts the line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant to leave this file to another slice: no other slice of PRD 1162 touches the sidebar (author)
