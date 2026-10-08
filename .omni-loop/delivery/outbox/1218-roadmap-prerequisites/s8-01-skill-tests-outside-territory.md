---
id: s8-01-skill-tests-outside-territory
prd: 1218
slice: s8
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

The new steps in the roadmap and drive instructions, and the new guide section, needed tests, but the files that test them were not on this slice's list of files it may change. Should the tests go there anyway?

## The decision, in plain words

The tests were added to the two existing test files that already check these instructions and the guide, next to the earlier roadmap tests, so a later change cannot quietly drop the new steps.

## The intro, for fun

A rule with no test is a wish written in nice words.

## The punchline, for fun

So the wish got a test, two files over.

## The options, in plain words

A. A. Add the tests to the existing plugin and guide test files (built).
B. B. Leave the new steps untested and rely on review.
C. C. Move the tests into a new file inside the slice's own folders.

## What I had to decide

Whether a slice that only changes instructions and the guide may add its tests to the shared test files that already check them.

## What I did meanwhile

The new tests run with every other test; nothing else in those files changed.

## What it costs to change later

Undoing it is deleting two blocks of tests; nothing depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- none known (author)
