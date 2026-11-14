---
id: s3-01-reviewer-limit
prd: 2873
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Now that the Reviewer lists a review skill, what should its third limit say in place of the old line that it has no skill to run yet?

## The decision, in plain words

A new Reviewer starts with the line that it never approves a pull request, the same shape as the PM and the Architect. Reviewers made before keep the limits they have, as the spec asks.

## The intro, for fun

The Reviewer finally got a skill, so its old excuse no longer holds.

## The punchline, for fun

It can look at your pull request, but the approval stays yours.

## The options, in plain words

A. Never approves a pull request, as the PM never approves a PRD (built).
B. Keep the old line that it has no skill to run yet.
C. Drop the third limit: the Reviewer keeps only the two every hero has.

## What I had to decide

Keep the new line, or pick other words for the Reviewer's third limit; reviewers already made keep theirs either way.

## What I did meanwhile

Built A: kit/lib/virtual-fleet/roles.ts and virtual_hero_roles() in the s3 migration give a new Reviewer `It never approves a pull request.`; the migration leaves every stored hero's limits as they are.

## What it costs to change later

A constant: one sentence in roles.ts and in the migration's list, which a test holds equal. Stored heroes are not touched.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the Designer's limits but not the Reviewer's; the old line `It has no skill to run yet.` became untrue once the Reviewer lists tech-review.
