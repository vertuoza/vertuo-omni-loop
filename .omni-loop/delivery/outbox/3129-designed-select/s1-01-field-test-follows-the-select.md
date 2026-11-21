---
id: s1-01-field-test-follows-the-select
prd: 3129
slice: s1
rank: medium
bears-on: none
raised: 2026-11-21
wave: 1
---

## The question, in plain words

The old test of the form field checked the browser's own dropdown, which the new list replaces. Is it right that this slice updated that one test file, which sits just outside its listed folders?

## The decision, in plain words

The test now checks the new list through the same label, hint and keyboard path, so the form field keeps its proof.

## The intro, for fun

A dropdown changed its coat, and an old test still asked for the old one.

## The punchline, for fun

The test got the new coat too, and nothing else moved.

## The options, in plain words

A. A. Update the form field's test in this slice, as built.
B. B. Leave the test red and let a later slice fix it.

## What I had to decide

Only the two lines of Field.dom.test.ts that read the native select changed; nothing else outside the slice's folders was touched.

## What I did meanwhile

The test file is updated on the slice branch and the checks are green.

## What it costs to change later

Reverting it is one file; a different answer would only mean moving those two lines to another slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 lists packages/ui/src/Select but not Field.dom.test.ts (author)
