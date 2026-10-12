---
id: s4-03-plugin-test-beside-law-proofs
prd: 1679
slice: s4
rank: high
bears-on: BR-PRODUCT-10
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The budget wording checks for three skills were added to the test file that proves four product rules, and no rule test changed. Do you agree those rules still hold as before?

## The decision, in plain words

The skill wording tests went into the existing skills test file, beside the rule proofs, and every rule proof was left as it was.

## The intro, for fun

Four rules share a test file, and a new neighbour just moved in.

## The punchline, for fun

The neighbour only checks the budget wording; the rules kept their keys.

## The options, in plain words

A. A. Keep the block where it is: no rule changed.
B. B. Move the budget block to its own test file, away from the rule proofs.

## What I had to decide

The slice added one test block, 'the context budget in the skills (PRD 1679)', and one import to kit/test/plugin.test.ts, the file whose tests prove BR-PRODUCT-3, -5, -10 and -11. No law test changed. The spec's Test seams asks for these skill tests; the plan placed them in this file. invade's skill text changed (s4), which BR-PRODUCT-10 governs; its proof stays green.

## What I did meanwhile

The branch carries the new block; every law test is unchanged and green.

## What it costs to change later

Moving the block to its own file later is a file move, no behaviour change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a skill-wording test may share a file with law proofs is not written in the testing form (author)
