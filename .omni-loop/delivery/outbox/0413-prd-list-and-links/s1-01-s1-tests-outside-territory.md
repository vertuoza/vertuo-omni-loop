---
id: s1-01-s1-tests-outside-territory
prd: 413
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Adding PRDs to the menu changed what two other pages' tests expect to see in the top bar. Should this slice update those tests itself, even though they belong to other parts of the app?

## The decision, in plain words

Yes. This slice updated the two tests so they expect PRDs in the menu, and no longer the old All PRDs link, and changed nothing else in those parts of the app.

## The intro, for fun

One new menu item, and two pages' tests noticed the new neighbour.

## The punchline, for fun

We told them it was invited.

## The options, in plain words

A. The menu slice updates every test the menu change breaks, wherever it lives (built).
B. Leave those tests red and let the slices that own those files fix them.
C. Widen the plan's territory for the menu slice to name those test files.

## What I had to decide

Whether the menu slice may fix the tests of the pages that show the menu, or whether each owner should.

## What I did meanwhile

The two tests expect PRDs in the menu and no All PRDs link; the full test run is green apart from one failure that already exists on the default branch.

## What it costs to change later

Undoing it is reverting two test lines; if another slice edits the same test file, the merge may need a small hand fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant territory to cover the tests a change breaks elsewhere is not written down (author).
