---
id: s1-01-config-rule-test-gains-retro-checks
prd: 2338
slice: s1
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-10-21
wave: 1
---

## The question, in plain words

The test file that proves the config's signature rule was touched to add the new retro setting: can a person confirm the rule it proves still holds as it did?

## The decision, in plain words

The rule's own checks are unchanged. The file gains the new setting's checks beside them, and its list of the config's sections now names the new section.

## The intro, for fun

A guard of the config's rules got a visitor.

## The punchline, for fun

Nobody moved the guard; the visitor just signed the book.

## The options, in plain words

A. A. Keep the new checks beside the rule's checks in the same file, the rule's own checks untouched.
B. B. Move the new setting's checks to a test file of their own, leaving only the one-word section list change in the rule's file.

## What I had to decide

Keep A, or move the new setting's checks to a test file of their own (B).

Decided by: Jev (hardToRevert 0.70) · agent said true

## What I did meanwhile

The new checks sit beside the rule's checks; nothing waits on the answer.

## What it costs to change later

B is a move of two test cases to a new file, with no change to the code.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The testing form asks that tests of other behaviour go in a file of their own, but the slice's territory names only this test file for the config; a new file would leave the territory. (author)
