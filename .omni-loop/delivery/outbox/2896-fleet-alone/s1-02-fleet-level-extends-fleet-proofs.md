---
id: s1-02-fleet-level-extends-fleet-proofs
prd: 2896
slice: s1
rank: high
bears-on: BR-GAME-2
raised: 2026-11-16
wave: 1
---

## The question, in plain words

Adding a level to every fleet changed the tests that prove how a fleet is made and who may change it: do you agree they still prove the same rules?

## The decision, in plain words

Every fleet is now made with a level, so the fleet tests pass the level with-you where they made a fleet, and new cases prove the level guard. No case that proves a fleet rule was removed or loosened.

## The options, in plain words

A. A. The proofs hold the same rules, with the level added (built).
B. B. Keep the old fleet proofs as they were and prove the level in separate tests only.

## What I had to decide

Before the feature pull request is marked ready.

## What I did meanwhile

The proofs run as changed; nothing is held.

## What it costs to change later

Low: the change only adds cases and new arguments; undoing it means removing the new cases.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The fleet controller and repository tests, and the database check for fleets, were read for this by the person who finished the PRD, not by the law's owner.
