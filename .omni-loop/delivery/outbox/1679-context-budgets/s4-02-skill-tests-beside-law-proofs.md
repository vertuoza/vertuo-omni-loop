---
id: s4-02-skill-tests-beside-law-proofs
prd: 1679
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

This slice added its tests to the file that also proves four product rules, leaving those rule tests untouched. Do you agree that no product rule changed here?

## The decision, in plain words

I added the new tests at the end of the file the plan named, leaving the product rule tests as they were. The kit's guard treats any change to that file as touching a rule, so it needs a person to confirm.

## The intro, for fun

The new tests moved into a building where the rule keepers live.

## The punchline, for fun

They knocked on no doors, but the guard still wants a signature.

## The options, in plain words

A. Keep the new tests in the file the plan named, since no rule changed (as built).
B. Move the new tests to a file of their own, so the rule tests' file stays untouched.

## What I had to decide

Agree that kit/test/plugin.test.ts changes no law proof (BR-PRODUCT-3, -4, -10 and -11 are untouched; the diff only adds the block "the context budget in the skills (PRD 1679)" and one import), or ask for the tests to move to a file of their own such as kit/test/budget-skills.test.ts.
Decided by: Jev (hardToRevert 0.74) · agent said true

## What I did meanwhile

The new tests sit at the end of kit/test/plugin.test.ts, as the plan's territory names it.

## What it costs to change later

Moving the block to its own file later is a cut and paste with no behaviour change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) omni check coverage refuses a spec account for a law-proof file: only a high item accounts for it, whatever the change. Every later PRD that adds a skill test to kit/test/plugin.test.ts will meet the same refusal; the guard may want to tell an added test from a changed law test.
