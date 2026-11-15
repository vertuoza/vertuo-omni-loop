---
id: s7-02-red-branch-names-the-last-joined-prd
prd: 2896
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 7
---

## The question, in plain words

When the mission branch's checks go red, which PRD does the mission name as the one to drop?

## The decision, in plain words

The mission names the PRD that joined the branch last, since the red head is its commit, and gives the drop line for it. A person may still drop another one.

## The intro, for fun

The last one through the door gets the blame.

## The punchline, for fun

Detectives call it the usual suspect.

## The options, in plain words

A. Name the PRD that joined last.
B. Name every PRD on the branch and let a person pick.

## What I had to decide

A red head of the mission branch names the PRD that joined last and holds every further join until the checks are green again or a PRD is dropped.

## What I did meanwhile

The check runs of the head are read once per run, and a head with no finished failure reads as not red.

## What it costs to change later

Finding the first PRD whose commit turned the checks red means reading the checks of each commit, which is one function to change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the PRD after a join but not how to find it when the red comes from a rebase or a late check.
