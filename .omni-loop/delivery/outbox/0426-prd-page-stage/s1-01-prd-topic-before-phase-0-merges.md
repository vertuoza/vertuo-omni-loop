---
id: s1-01-prd-topic-before-phase-0-merges
prd: 426
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Before its spec is approved, a PRD has no folder on the main branch yet, so the page cannot tell which branch names belong to it. How should the page find them?

## The decision, in plain words

The page looks through the repository's recent pull requests for the spec pull request that names the PRD by its number, and takes the branch name from it. When none names it, the page says nothing is there yet.

## The intro, for fun

A PRD with no folder yet is a house with no street number.

## The punchline, for fun

So the page asks the neighbours: the pull request that mentions it by name.

## The options, in plain words

A. A: find the spec pull request by the PRD's link line in its description (built)
B. B: show no Approve spec button before the spec is approved, only Spec being written
C. C: store the topic in the dossier when the kit pushes the spec, which needs a migration

## What I had to decide

Whether finding the PRD's spec pull request by the number written in its description is good enough before the spec is approved.

## What I did meanwhile

The page scans the latest hundred pull requests once a minute at most, and shows the PRD stage with its Approve spec button when it finds one.

## What it costs to change later

A constant: the fallback is one function in the reader; removing it leaves the stage as PRD with Spec being written until the spec is approved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the feature branch's inbox as a third place, which needs the topic already known, so it was not used (author).
