---
id: s7-02-one-slice-still-a-sub-pr
prd: 7
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When a PRD is small enough to be one piece of work, should it still go through a separate sub-change, or be built straight on the feature branch?

## The decision, in plain words

Even a one-piece PRD gets its own sub-change into the feature branch. That keeps a single path for building, checking and merging work.

## The options, in plain words

A. Always a sub-PR, one slice or many
B. A lone slice is built on the feature branch and the feature PR is its PR (upstream)

## What I had to decide

Whether a one-slice plan skips the sub-PR (upstream) or keeps it.

## What I did meanwhile

Every slice is a sub-PR, even when the plan has one slice, because /omni:do-work and /omni:wave only know the sub-PR path.

## What it costs to change later

One extra branch and PR for tiny PRDs; reverting means a one-slice path in do-work, wave and board.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Upstream built a lone slice on the feature branch; nothing in PRD 7's spec says which to keep. (author)
