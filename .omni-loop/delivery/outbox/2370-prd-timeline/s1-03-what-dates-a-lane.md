---
id: s1-03-what-dates-a-lane
prd: 2370
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

The spec leaves three dating details open: whether approval comes from the stored stage, which ready moment counts when a pull request goes back to draft, and which pull requests count as slices. Are the choices below right?

## The decision, in plain words

Approval is the phase-0 merge or the first approval, never the stored stage, which can hold the sync's own time. Ready is the first time the feature pull request was marked ready, and a slice is any pull request merged into the feature branch.

## The intro, for fun

Three clocks, one question: which tick counts?

## The punchline, for fun

We picked the ones GitHub signs, never the sync's own watch.

## The options, in plain words

A. Approval from GitHub or the page, the first ready moment, and any pull request merged into the feature branch as a slice.
B. Approval from the stored stage, the latest ready moment, and only slice-shaped branches as slices.

## What I had to decide

Answer A to keep these three choices. Answer B to take approval from the stored stage, the latest ready moment, and only slice-shaped branches as slices.

## What I did meanwhile

The sync dates approval from the phase-0 merge or the first approval, never the sync's time; ready from the first ready event of the feature pull request (its opening when opened ready); and first and last slice from every pull request merged into the feature branch, the last one before the feature pull request merged.

## What it costs to change later

A: none. B: a constant each in the sync's milestone code; a time already recorded stays, since the first time wins, so a change applies to PRDs not yet dated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A pull request with more than a hundred events is read on its first page only; its first ready event is almost always there, as events come oldest first. (author)
