---
id: s1-01-knowledge-bar-test-outside-territory
prd: 346
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Every top bar now carries Release notes, so the knowledge map page test, which lists its bar buttons, had to learn the new one even though this slice was not meant to touch it. Was updating that test the right call?

## The decision, in plain words

We updated that one test so it expects Release notes between the star chart link and the theme switch, and changed nothing else in it.

## The intro, for fun

A new button walked into the knowledge map's top bar and its test noticed at once.

## The punchline, for fun

We introduced them properly, with one line changed and no hard feelings.

## The options, in plain words

A. Update the test in this slice: What was built: the knowledge page's bar test lists Release notes, one line changed.
B. Widen the plan's territory instead: Add the knowledge page's test to the slice's territory in the plan, so the change is inside bounds; the test line stays the same.
C. Move the bar check out of that test: Drop the knowledge page's own list of bar buttons and let the shared header test cover it alone.

## What I had to decide

Whether a slice may update a neighbouring test that its own change turns red, when the plan did not list that test's file.

## What I did meanwhile

The knowledge map's test expects Release notes in its bar, and the whole suite is green apart from a date-format test that fails on the base branch too.

## What it costs to change later

Cheap to change: one line in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec asks that every bar show Release notes, which settles the test's new line; only the territory was unsaid (author)
