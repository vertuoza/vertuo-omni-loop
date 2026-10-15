---
id: s4-01-plugin-test-beside-law-proofs
prd: 1972
slice: s4
rank: high
bears-on: BR-PRODUCT-3
raised: 2026-10-15
wave: 3
---

## The question, in plain words

The checks behind three locked rules share a test file that @pierrederval owns, and the new bug-fix proof tests were added beside them. Is that right, with those checks left as they are?

## The decision, in plain words

The new tests were added at the end of the plugin test file, after the checks for the three locked rules, and none of those checks was touched.

## The intro, for fun

Some tests share a house; the new ones moved in quietly.

## The punchline, for fun

The old tenants did not have to move a single chair.

## The options, in plain words

A. A. New tests added after the law proofs in the same file (as built)
B. B. New tests in a separate test file, leaving the owner's file untouched

## What I had to decide

Approve the pull request on GitHub as @pierrederval to accept that kit/test/plugin.test.ts gains tests only. No amendment line is needed: no law text and no proof of a law changed.

## What I did meanwhile

The tests run and pass in the preflight; the three law proofs are byte for byte as they were.

## What it costs to change later

Moving the new tests to a new file later costs one cut and paste, but the spec asked for them in plugin.test.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether @pierrederval prefers a separate test file was not asked (author)
