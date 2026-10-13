---
id: s5-04-plugin-tests-extended-for-locked-laws
prd: 1726
slice: s5
rank: high
bears-on: BR-PRODUCT-3
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The test file that proves several rules about the skills gained new tests for locked laws; do you accept the change to it?

## The decision, in plain words

Yes: the new tests were added at the end, in a group of their own, and every test already there still checks exactly what it did.

## The intro, for fun

A test file that guards six rules got a new neighbour at the end of the street.

## The punchline, for fun

Nobody moved house; the old tests did not even notice.

## The options, in plain words

A. A. Accept the extended test file as built.
B. B. Move the new tests to a file of their own and leave the rules' proof untouched.

## What I had to decide

Accept A, or choose B and the new tests move to a file of their own.
Decided by: Jev (hardToRevert 0.72) · agent said true

## What I did meanwhile

The new group checks that each skill reads only the laws a change touches and writes about a law in one plain sentence.

## What it costs to change later

Moving the group to its own file later is a cut and paste, plus that file in the slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names this file as the slice's territory, so a separate file was not an option inside it (author).
