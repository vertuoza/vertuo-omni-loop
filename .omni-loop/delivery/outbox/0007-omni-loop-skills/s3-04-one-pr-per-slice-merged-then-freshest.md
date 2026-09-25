---
id: s3-04-one-pr-per-slice-merged-then-freshest
prd: 7
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When more than one pull request matches the same slice, for example an old attempt plus a new one, which one should the board actually show?

## The decision, in plain words

A merged pull request always wins; otherwise the most recently updated one does.

## The options, in plain words

A. Merged wins, then most recently updated (what was built).
B. Always take the most recently opened pull request, merged or not.
C. Refuse to pick and report every candidate as a conflict for a person to resolve.

## What I had to decide

How to pick a single pull request for a slice when its branch name matches more than one candidate.

## What I did meanwhile

Preferred a merged match over any open one, and the most recently updated one among ties — a slice can only be building towards one outcome at a time, and a merge is the more final signal.

## What it costs to change later

Changing the tie-break rule is local to the one selection function; nothing downstream depends on which candidate was dropped.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nothing in the plan or spec says a slice's branch name could ever match more than one pull request, or how to choose when it does.
