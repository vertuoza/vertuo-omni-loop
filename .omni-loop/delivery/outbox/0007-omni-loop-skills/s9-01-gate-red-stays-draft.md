---
id: s9-01-gate-red-stays-draft
prd: 7
slice: s9
rank: medium
bears-on: none
raised: 2026-09-25
wave: 5
---

## The question, in plain words

When the build finishes but questions are still open, should the finished work be put up for review as ready, or stay a draft?

## The decision, in plain words

It stays a draft, with every open question posted on it. It becomes ready only once nothing is open and the work has been filed as shipped.

## The options, in plain words

A. Stay draft while the gate is red; ready only after ship (built).
B. Mark ready with the gate red, as upstream did, and ship later in yolo-fix; rule 7 would then apply to the merge, not to ready.
C. Mark ready with the gate red but add the needs-fix label so nobody merges it.

## What I had to decide

Upstream yolo marked the feature PR ready and stopped with the outbox check red, as its expected end state. Spec section 2.1 rule 7 (ship before ready) says ready comes only after omni ship, which refuses while items are open. Spec section 2's table row for yolo first said it ends ready with the gate red; commit ee15122 aligned it with rule 7.

## What I did meanwhile

The skill leaves the feature PR in draft when omni status is red, posts the questions with omni comment --pr, and reports that a person answers on the PR then runs yolo-fix. gh pr ready runs only on the green path, after ship is committed and pushed.

## What it costs to change later

Low: one paragraph of skill prose. The only effect is whether CI runs on the feature PR before the questions are answered.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Spec section 2's yolo row contradicted rule 7 until ee15122; upstream's ready-with-a-red-gate remains the alternative a reviewer may prefer. (author)
- A draft PR gets no CI run, so the feature is graded only by the local preflight until yolo-fix ships it. (author)
