---
id: s3-01-approval-on-the-latest-commit
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When an owner approves a change to a locked law and someone pushes again afterwards, should the approval still count?

## The decision, in plain words

No: only an approval given on the latest commit counts, so every push after it asks the owner to approve again.

## The intro, for fun

An owner said yes, then the branch moved on.

## The punchline, for fun

A yes is for the change they saw, not for the next one.

## The options, in plain words

A. Only an approval of the latest commit counts (built).
B. Any standing approval counts, whatever was pushed after it.
C. An approval counts until a later push changes a file that fired the rule.

## What I had to decide

Whether an approving review of an older commit of the pull request still clears law-locked once new commits are pushed.

## What I did meanwhile

approversOf (apps/omni-app/src/outbox-check/law-locked.ts) keeps each reviewer's latest standing review (approved, changes requested or dismissed; a comment changes nothing) and counts it only when its commit_id is the head SHA being checked. The end-to-end test pins that an approval of an older commit leaves the check red.

## What it costs to change later

One comparison in approversOf: dropping the commit test makes any standing approval count, with its test updated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says only an approving review clears it; it does not say which commit the review must be of.
- (author) A feature PR gets pushes from waves and from pr-care after the owner approved; each one asks the owner again, as GitHub's own 'dismiss stale approvals' setting would.
