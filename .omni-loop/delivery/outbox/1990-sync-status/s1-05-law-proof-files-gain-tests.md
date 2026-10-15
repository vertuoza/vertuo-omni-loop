---
id: s1-05-law-proof-files-gain-tests
prd: 1990
slice: s1
rank: high
bears-on: N-PRODUCT-13
raised: 2026-10-15
wave: 1
---

## The question, in plain words

Two test files that prove rules of the product were touched to add the new setting: can a person confirm the rules they prove still hold as they did?

## The decision, in plain words

The rules' own checks are unchanged: one file gains the new setting's checks beside them, and in the other one line now ignores comment lines, so the new commented setting is not mistaken for a key the install must never write.

## The intro, for fun

Two guards of the product's rules got a visitor.

## The punchline, for fun

Nobody moved the guards; the visitor just signed the book.

## The options, in plain words

A. Keep both edits: the laws' checks are untouched, and the files gain or narrow one check of other behaviour.
B. Move the sync section's config tests to a file of their own, leaving the law's file as it was.
C. Write no commented sync block in the config omni init writes, so the install's test needs no change.

## What I had to decide

kit/lib/config.test.ts proves BR-PRODUCT-23 (the signature's name and address refusals); s1 added a describe block for the sync section (spec section 6) and one key, 'sync', to the list of the config's sections, leaving the signature checks as they were. kit/bin/init.test.ts proves N-PRODUCT-13 (the install writes only inside its own folder, locked by @pierrederval) and BR-PRODUCT-7; s1 changed the line of 'writes neither knowledge key' from refusing any 'knowledge:' to refusing it on lines that are not comments, because the commented sync block omni init now writes holds '#     knowledge: orange'. No check of either law changed. Changing a file that proves a locked law needs @pierrederval to approve the feature pull request.

## What I did meanwhile

Both files pass; the laws' own assertions are byte for byte what they were.

## What it costs to change later

Each change is one block or one line, undone by a revert of this slice's commits.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the sync section's tests should live in a file of their own, apart from the file that proves BR-PRODUCT-23, was not asked (author).
