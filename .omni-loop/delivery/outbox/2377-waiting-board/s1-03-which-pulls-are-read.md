---
id: s1-03-which-pulls-are-read
prd: 2377
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

Which changes should the board look at, and may it read one more thing on GitHub for some of them to date their wait?

## The decision, in plain words

It looks at a change only when it can tell which PRD it belongs to, or when it is a labelled bug fix or visual update. To know since when a review was asked, it also reads the change's history, which it already did for feature changes.

## The intro, for fun

Every branch named feat looks like ours from far away.

## The punchline, for fun

So we only count the ones that can show their papers.

## The options, in plain words

A. Count a pull request only when its PRD is known or it is a labelled fix, and read its events to date a review, the option built.
B. Count every pull request on a feature-shaped branch, even with no PRD found, shown without one.
C. Read no events beyond a feature PR's, and date a phase-0 or fix review from when it was opened.

## What I had to decide

Which pull requests into the default branch count as waits (spec §1 lists phase-0, feature, bug fix and visual update ones), and whether dating a review wait may cost a third read per pull request beyond the spec's two.

## What I did meanwhile

A feature or phase-0 pull request counts only when its PRD is known: its folder's topic, else the link line its body carries (Closes #n, Refs #n). Its events are read for when a review was last asked; a feature PR's were already read, so the new read is only for phase-0 and fix pull requests that are open, ready and changed.

## What it costs to change later

One condition in apps/galaxy/src/stages/sync/waits.ts (waitedPull) and the events read in github.ts; no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many extra GitHub reads this costs a busy repository per run was not measured; it is bounded by the open, ready, changed phase-0 and fix pull requests (author)
