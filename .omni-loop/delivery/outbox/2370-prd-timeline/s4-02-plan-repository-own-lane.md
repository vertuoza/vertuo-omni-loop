---
id: s4-02-plan-repository-own-lane
prd: 2370
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

When a PRD of a plan repository builds nothing in the plan repository itself, should its own pull request still count as one of its lanes?

## The decision, in plain words

Its own pull request always counts as a lane, as for any PRD. The spec says it counts only when it carries work of its own, so the PRD is done when that pull request merges, not at the last target's merge.

## The intro, for fun

The conductor walks on stage too, even without an instrument.

## The punchline, for fun

Nobody is sure whether to time the applause from the last violin or from the bow.

## The options, in plain words

A. Keep it: the plan's own pull request is always a lane, and the PRD is done when the last lane merges, the plan's included.
B. Leave the plan's own lane out of the timeline when it has no work of its own and the PRD has target lanes, as the spec says, filtered where the timeline is read.

## What I had to decide

The spec (section 1) says the plan repository's own feature PR is a lane 'when it carries slices of its own'. The sync writes the plan repository's lane from its feature PR as s1 does for every PRD (`milestonesOfRepo`), whatever slices it has.

## What I did meanwhile

Built A: the plan's lane is recorded whenever its feature PR exists, with no first-slice or last-slice when no sub-PR merged into it, so its Starting and Building read `not recorded`. Dropping it at write time is not reliable: the plan's feature PR opens at planning, before any target PR exists, and a milestone once written is kept.

## What it costs to change later

Low. Option B is a filter where the timeline is read (`timeline()` or the views): a lane of the PRD's own repository with no first-slice is left out when the PRD has another lane. No stored row changes, and no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a plan repository's feature PR usually merges before or after its targets' PRs is not known here; it decides whether A moves the PRD's done time.
- (author) The fix belongs to `apps/galaxy/src/timeline/`, outside this slice's territory.
