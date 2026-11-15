---
id: s6-03-landing-knowledge-branch-name
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

The knowledge pull request of a landing needs a branch name, and the spec names none. Which name does it take?

## The decision, in plain words

The repository's knowledge branch shape, filled with the word landing and the mission pull request's number, so two landings of one mission never share a branch and each gets its own pull request.

## The intro, for fun

Every delivery needs a label on the box.

## The punchline, for fun

This one says which truck brought it.

## The options, in plain words

A. Name it after the landing's pull request (built).
B. Name it after the mission, so a mission landed in parts shares one knowledge branch.

## What I had to decide

Keep the branch named after the landing's pull request, or name it after the mission so its landings share one branch.

## What I did meanwhile

A landing's harvest commits on a branch named by the knowledge branch shape with landing and the mission pull request's number.

## What it costs to change later

A different name later is one constant; branches already opened keep theirs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's naming table has no row for a landing's knowledge branch.
