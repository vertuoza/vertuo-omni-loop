---
id: s3-01-target-pr-judged-on-feature-pr
prd: 1612
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

A pull request in another repository that is part of a PRD holds none of the PRD's approved files. What should its approval check compare against?

## The decision, in plain words

It compares the approved files with the PRD's own open feature pull request in the PRD's repository. When that pull request is missing or cannot be read, the check is held, never failed.

## The intro, for fun

The target repository has the code, but the approved plan lives next door.

## The punchline, for fun

So the check knocks on the neighbour's door, and waits politely if nobody answers.

## The options, in plain words

A. A. Judge on the PRD's open feature PR head; held when it is missing or unreadable.
B. B. Judge on the PRD repository's default branch.
C. C. Post approved or waiting from the record alone, without comparing files, on a target PR.

## What I had to decide

Confirm the target PR's check is judged on the PRD's feature PR head, held when that PR cannot be found or read.

## What I did meanwhile

A target PR's check reads the PRD repository's open 'Closes #<n>' feature PR head through the same installation; its Details link carries that head's sha. No open feature PR, or a 403/404, posts the neutral held title.

## What it costs to change later

One function in apps/omni-app/src/approved-check/github.ts (featurePullOf) and the target branch of judgePull.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'compares each pinned file with the same file at the PR's head', which a target PR's head does not hold; this reading of it is the author's.
