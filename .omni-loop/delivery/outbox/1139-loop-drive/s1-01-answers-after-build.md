---
id: s1-01-answers-after-build
prd: 1139
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

When a person answers the open questions while slices are still being built, should the loop rework right away or finish building first?

## The decision, in plain words

The loop finishes building every slice first, then picks up the answers and reworks. Answers to decisions already adopted without asking are not yet read by this step.

## The intro, for fun

Someone answered while the builders were still hammering.

## The punchline, for fun

The loop reads the answers once the walls are up.

## The options, in plain words

A. Finish building first, then rework on the answers; objections to adopted decisions wait for the rework skill.
B. Rework as soon as an answer lands, even mid-build.
C. Finish building first, and also count objections to adopted decisions as answers.

## What I had to decide

Whether answers posted mid-build should interrupt the waves, and whether an objection to an adopted decision should wake the rework step.

## What I did meanwhile

The answer check only counts once every slice is merged, and it reads the open questions as they stand on the feature branch, matched against the replies on the feature PR. Objections to adopted decisions are left to the rework skill when it runs.

## What it costs to change later

Small: one condition in the verdict and one extra read of the settled ledger. No stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people often answer mid-build, and whether an objection to an adopted decision alone should start a rework.
