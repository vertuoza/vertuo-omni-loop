---
id: s2-01-budget-drops-the-bundle
prd: 2809
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When a runner has too many saved jobs on its disk, should the oldest save go whole, or should only its big folder go while its small saved copy stays?

## The decision, in plain words

The oldest save goes whole: its folder and its saved copy are both removed, and its record says what was lost, as the design describes.

## The intro, for fun

Every disk fills up one day, and somebody has to choose what gets thrown out first.

## The punchline, for fun

Spring cleaning, with a receipt for everything that went in the bin.

## The options, in plain words

A. A. The oldest save goes whole, folder and bundle; its manifest names what was lost (built)
B. B. Only the folder goes; the bundle stays until its keep date, so nothing committed or uncommitted is lost, only ignored files
C. C. The bundle goes first and the folder stays, since the folder alone can still be pushed by hand

## What I had to decide

Keep A, or choose B: on a runner over its keep budget, remove only the oldest kept folder and keep its bundle (a few MB) until its keep date, so the resume can still take the work back.

## What I did meanwhile

Over `--keep-budget`, `keepWithin` (kit/lib/runner/sweep.ts) removes the oldest kept folder and its bundle `<folder>.checkpoint.bundle`, and rewrites its manifest with `lost: { at, why }`; the manifest stays until `keepUntil`. Both the folder and the bundle count toward the budget.

## What it costs to change later

A constant: B is a few lines in `dropKept` (keep the bundle, count its bytes only) and a test change. No stored shape changes: the manifest already carries `bundle` and `bundleBytes`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person reads "the oldest kept folder is removed" as the save going, or only the folder (author)
