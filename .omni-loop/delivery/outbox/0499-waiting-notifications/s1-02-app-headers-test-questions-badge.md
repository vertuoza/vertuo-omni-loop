---
id: s1-02-app-headers-test-questions-badge
prd: 499
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

May this slice change a test of every app page's menu that lies outside its own ground, now that Questions carries a count?

## The decision, in plain words

Yes: the shared test of every app page's menu now accepts a count after Questions, as it already did after Shared with me. Nothing else in it changed.

## The intro, for fun

The menu learned to count, and an old test thought it was a typo.

## The punchline, for fun

We taught the test to read numbers too.

## The options, in plain words

A. Change the one line so the menu test accepts a count after Questions (built).
B. Leave that test untouched and let a later slice that owns it fix it.

## What I had to decide

Whether a one-line change to a test outside the slice's ground is acceptable.

## What I did meanwhile

The test accepts an optional count after Questions, so it passes with and without questions waiting.

## What it costs to change later

Reverting the one line in that test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the menu test of every app page to no slice; its territory lists the sidebar's own tests only.
