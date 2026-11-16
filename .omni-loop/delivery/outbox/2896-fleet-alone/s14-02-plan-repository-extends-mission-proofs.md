---
id: s14-02-plan-repository-extends-mission-proofs
prd: 2896
slice: s14
rank: high
bears-on: BR-PRODUCT-137
raised: 2026-11-16
wave: 14
---

## The question, in plain words

Refusing own-branch in a plan repository added cases to the tests that prove what a valid brief is and who approves a PRD: do you agree they still prove the same rules?

## The decision, in plain words

Cases were added for the refusal only. No case that proves either rule was removed or loosened.

## The options, in plain words

A. A. The proofs hold the same rules, with the refusal cases added (built).
B. B. Move the refusal cases out to tests of their own.

## What I had to decide

Before the feature pull request is marked ready.

## What I did meanwhile

The proofs run as changed; nothing is held.

## What it costs to change later

Low: the change only adds cases and new arguments; undoing it means removing the new cases.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The brief and mission service tests were read for this by the person who finished the PRD, not by the laws' owner.
