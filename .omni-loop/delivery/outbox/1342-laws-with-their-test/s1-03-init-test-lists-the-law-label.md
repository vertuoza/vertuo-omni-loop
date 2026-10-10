---
id: s1-03-init-test-lists-the-law-label
prd: 1342
slice: s1
rank: high
bears-on: N-PRODUCT-13
raised: 2026-10-10
wave: 1
---

## The question, in plain words

The test file that proves how the kit writes a repository's settings also checks which labels the kit creates, and this work added the new law label to that list. Is it all right to change that file?

## The decision, in plain words

Yes: only the list of expected labels gained the new law label; the checks that prove the settings rule were left exactly as they were.

## The intro, for fun

A new name was added to the guest list kept in the security guard's office.

## The punchline, for fun

The guard's own rules were not touched, but the office still asks who signed in.

## The options, in plain words

A. A. Keep the new law label in the setup test's list of labels, with the settings checks untouched (built).
B. B. Move the list of labels to a test file of its own, so the settings rule's proof file does not change.

## What I had to decide

Whether the label lists in kit/bin/init.test.ts, the proof file N-PRODUCT-13 names beside kit/lib/init/settings.test.ts, may gain omni:law.

## What I did meanwhile

s1 appended omni:law to LOOP_LABELS and to two expectations of the created labels; no line of the tests proving N-PRODUCT-13 changed.

## What it costs to change later

A constant: move the label-list expectations to a test file of their own, which then no law names.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Found by omni check coverage after the waves: s1 changed the file outside its territory and raised no item for it.
