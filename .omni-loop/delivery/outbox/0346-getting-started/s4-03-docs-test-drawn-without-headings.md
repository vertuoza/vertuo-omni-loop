---
id: s4-03-docs-test-drawn-without-headings
prd: 346
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

A test of the docs pages relied on the Install page having no headings, which stopped being true once it was written in full. How should it be fixed?

## The decision, in plain words

The test now draws a made-up page with no headings instead of the real Install page. It is a file outside this slice's own ground, changed by one test only.

## The intro, for fun

The test was counting on the Install page staying blank forever.

## The punchline, for fun

It now brings its own blank page, and nobody has to stop writing.

## The options, in plain words

A. Draw a made-up page with no headings in the test.
B. Drop the check that a page with no headings has no table of contents.

## What I had to decide

Whether the fix to the test is right, or the check should be dropped.

## What I did meanwhile

The test draws its own page; every other docs test is unchanged.

## What it costs to change later

Low: one test. Reverting it would make the docs tests red again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives this test file to the slice that built the docs pages, not to this one (author)
