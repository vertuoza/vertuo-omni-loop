---
id: s2-03-pass-red-ci-goes-to-care
prd: 2871
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

After the Reviewer marks a pull request ready, the spec has it follow the pull request until its checks are green or stuck, which can mean fixing a red check, while the spec also says the Reviewer writes no code. Which one wins?

## The decision, in plain words

The Reviewer writes no code: it marks the pull request ready, waits for its checks to finish, and hands a red check to the skill that looks after the pull request. A pass it cannot take to ready, because nothing shipped or questions are still open, is posted and ends as a stop, saying why.

## The intro, for fun

The Reviewer was asked to grade the homework and, maybe, also fix it.

## The punchline, for fun

It kept the red pen and passed the eraser along.

## The options, in plain words

A. The Reviewer fixes nothing: a red check after ready goes to the care skill, and a pass it cannot mark ready ends as a stop (built).
B. The Reviewer fixes a red check after ready itself, as the pull request skill's lifecycle does, writing code for that alone.

## What I had to decide

Spec section 1, On pass: "then `/omni:pr`'s lifecycle until CI is green or stuck"; acceptance: "it never approves or requests changes, and writes no code". `/omni:pr`'s lifecycle fixes a red check. The skill watches the checks as that lifecycle does and fixes none; green or red it ends on `/omni:pr-care <n>` (the runner reads `ready`), checks that never finish end `review: CI never settled on PR #<pr>` (stopped). A pass with the PRD not shipped or the gate red posts the review, marks nothing and ends `review: passed PR #<pr>, not marked ready: …`, which a mission reads as stopped.

Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

Built as option A in step 6 of the skill.

## What it costs to change later

A constant: option B is a few lines of the skill and changes no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a mission should read a pass that could not be marked ready as stopped, or as its own ending.
