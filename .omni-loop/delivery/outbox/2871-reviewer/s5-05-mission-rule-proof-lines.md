---
id: s5-05-mission-rule-proof-lines
prd: 2871
slice: s5
rank: medium
bears-on: BR-PRODUCT-139
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Two tests prove the rule that a mission never sends a PRD again once it failed, was held twice or was cancelled. They now expect each build to be sent for review: may they change that way?

## The decision, in plain words

The two tests keep every check they made and now expect the build sent for review, with each job knowing its step. The Reviewer's own tests went to new files beside them.

## The intro, for fun

The rule's two witnesses had to learn a longer name for the same build.

## The punchline, for fun

Same story, same verdict, one more word on the badge.

## The options, in plain words

A. A. Accept the two proofs, each build now sent for review (built).
B. B. Keep the proofs as they were, and send the build for review only under a mission's Reviewer, a second line beside the old one.

## What I had to decide

Accept the two proofs as changed (A), or ask for them back as they were, the build line kept as before outside a mission's review (B).

Decided by: Jev (hardToRevert 0.50) · agent said true

## What I did meanwhile

In `supervisor.test.ts` the run helper sets `step: 'build'`, `runOfKey` reads back `step: 'build'`, and two dispatch sentences read `Sent /omni:yolo 1 --for-review …`; in `mission.e2e.test.ts` six expected lines gain ` --for-review`. No assertion was removed or loosened. The Reviewer's tests are in `supervisor.reviewer.test.ts` and `mission.reviewer.e2e.test.ts`.

## What it costs to change later

Putting the line back is one function and the same eight expected lines; the rule itself, and what its tests check, does not move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The rule is proposed and nobody has confirmed it yet, so who answers for its proof is the PRD's owner.
