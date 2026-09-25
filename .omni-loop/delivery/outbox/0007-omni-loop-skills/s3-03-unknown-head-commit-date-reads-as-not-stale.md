---
id: s3-03-unknown-head-commit-date-reads-as-not-stale
prd: 7
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a pull request's head commit date cannot be read at all, should the board assume the claim has moved on so it is never called stale, or assume it has not so an old, quiet draft still gets flagged?

## The decision, in plain words

An unknown head commit date is treated as if the claim had moved on, so the slice is never marked stale on that signal alone.

## The options, in plain words

A. Missing head commit date reads as "moved on", so the slice is never marked stale on this signal alone (what was built).
B. Missing head commit date reads as no commit since the claim, so an old, untouched draft can still go stale even without this signal.

## What I had to decide

What the claimed-stale check does when a pull request payload carries no head commit date at all.

## What I did meanwhile

Read a missing head commit date as "assume it has moved on" — the safer direction, since this state exists to let the kit reclaim a cold claim on its own, and reclaiming a claim on a signal that was never actually confirmed risks taking work out from under someone still building it.

## What it costs to change later

Flipping the fallback is a small, local change with no format change; it only matters when a head commit date genuinely could not be read for an old, open draft.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The task names the head commit date as available only "if available", without saying what to assume when it is not; a first pass assumed the opposite (unknown counts as stale) before this round settled it the other way.
