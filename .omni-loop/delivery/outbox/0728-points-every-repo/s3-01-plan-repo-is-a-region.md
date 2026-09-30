---
id: s3-01-plan-repo-is-a-region
prd: 728
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When a feature is built across several repositories, should the planning repository, which holds only documents, count as one of the planet's regions?

## The decision, in plain words

It counts, as the spec reads: the planet is one region larger, its planning pull request must also merge before the planet is terraformed, and a planning repository that belongs to no sector makes every such feature count as crossing sectors.

## The intro, for fun

A planet with a region made only of paperwork.

## The punchline, for fun

The filing cabinet gets a flag on the map too.

## The options, in plain words

A. The planning repository is a region (what was built): one more region, its feature PR waited for, and its own sector when no sector names it.
B. Only the target repositories are regions: the home still gives the spec, plan and outbox, but adds no region, no class and no sector; the terraform waits for the targets only.
C. A region, but in no sector: keep the region and the terraform wait, but leave it out of the cross-sector count.

## What I had to decide

Whether the planning repository is a region of a multi-repository planet (size, cross-sector bonus, terraform wait), or only the place its plan and answers are read from.

## What I did meanwhile

The planning repository is the planet's first region; each target repository with a Part of feature PR is one more.

## What it costs to change later

Reversing it is a filter in game/sources/github.mjs (drop the home region when every slice names another repository, and carry its blockers to the targets). Events already written keep the extra region's surveyed event and the planet's class and cross-sector flag at terraform.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a planning repository should be put in a sector so the cross-sector bonus is not always paid (author)
