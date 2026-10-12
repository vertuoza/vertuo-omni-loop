---
id: s1-04-rule-tests-extended-for-locks
prd: 1726
slice: s1
rank: high
bears-on: BR-PRODUCT-95
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Two test files that prove existing rules gained new tests for locked laws; do you accept the change to them?

## The decision, in plain words

Yes: every existing test in them still checks what it did, and one settings test now also expects the two new law settings with their defaults.

## The intro, for fun

Two test files grew a new chapter.

## The punchline, for fun

The old chapters were not rewritten, just given a sequel.

## The options, in plain words

A. A. Accept the extended tests as built.
B. B. Move the new law tests to files of their own and leave both proofs untouched.

## What I had to decide

Whether the changes to the test files proving the signature-settings rule and the every-law-names-its-test rule are accepted.

## What I did meanwhile

The knowledge check's tests gained a section for locked laws, and the settings tests gained one for laws.max and laws.owners. One existing settings expectation now lists the two new defaults beside requireProof; nothing it checked before was dropped.

## What it costs to change later

Reverting is removing the new test sections and two keys from one expectation.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The same change also touches the test proving the signature-settings rule (BR-PRODUCT-23); this item covers both files.
