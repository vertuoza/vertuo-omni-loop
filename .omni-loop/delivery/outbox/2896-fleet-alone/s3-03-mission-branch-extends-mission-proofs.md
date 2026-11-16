---
id: s3-03-mission-branch-extends-mission-proofs
prd: 2896
slice: s3
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-16
wave: 3
---

## The question, in plain words

The mission branch added cases to the tests that prove a mission never resends a failed PRD and that the config refuses a bad signature: do you agree they still prove the same rules?

## The decision, in plain words

The supervisor's test mission now carries its level, and cases were added for the mission branch and for the new branch name in the config. No case that proves either rule was removed or loosened.

## The options, in plain words

A. A. The proofs hold the same rules, with the mission branch cases added (built).
B. B. Move the mission branch cases out to tests of their own.

## What I had to decide

Before the feature pull request is marked ready.

## What I did meanwhile

The proofs run as changed; nothing is held.

## What it costs to change later

Low: the change only adds cases and new arguments; undoing it means removing the new cases.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The supervisor, mission end-to-end and config tests were read for this by the person who finished the PRD, not by the laws' owner.
