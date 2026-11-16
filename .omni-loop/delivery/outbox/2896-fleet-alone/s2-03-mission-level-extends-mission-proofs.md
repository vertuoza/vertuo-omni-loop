---
id: s2-03-mission-level-extends-mission-proofs
prd: 2896
slice: s2
rank: high
bears-on: BR-PRODUCT-137
raised: 2026-11-16
wave: 2
---

## The question, in plain words

Adding a level and two bounds to a mission's mandate changed the tests that prove what a valid brief is and who approves a PRD: do you agree they still prove the same rules?

## The decision, in plain words

A mandate now also reads a level and two bounds, each with a default, so tests that read a whole mandate expect those defaults and new cases prove each field. No case that proves either rule was removed or loosened.

## The options, in plain words

A. A. The proofs hold the same rules, with the new mandate fields added (built).
B. B. Keep the old brief proofs as they were and prove the new fields in separate tests only.

## What I had to decide

Before the feature pull request is marked ready.

## What I did meanwhile

The proofs run as changed; nothing is held.

## What it costs to change later

Low: the change only adds cases and new arguments; undoing it means removing the new cases.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The brief and mission service tests were read for this by the person who finished the PRD, not by the laws' owner.
