---
id: s2-03-failed-save-keeps-folder
prd: 2809
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

If the runner tries to save a job's unfinished work and the save itself breaks, should it keep the job's folder anyway, or remove it as it did before this feature?

## The decision, in plain words

It keeps the folder, with a note saying the save failed and why. The folder still goes after seven days, or sooner when the disk budget is full.

## The intro, for fun

Sometimes the box you were packing breaks before the move is finished.

## The punchline, for fun

So the furniture stays in the old flat, with a note on the door.

## The options, in plain words

A. A. Keep the folder, its manifest saying the save failed (built)
B. B. Remove the folder as before, the failure printed only
C. C. Keep the folder and stop the runner taking new jobs until a person looks

## What I had to decide

Keep A, or choose B: a save that fails removes the folder as before, and only the runner's printed line says so.

## What I did meanwhile

`saveJob` (kit/lib/runner/checkpoint.ts) catches any failure of the listing, snapshot or bundle, writes the manifest with `bundle: null`, `branches: []` and `failed: 'the save failed: <first line of the error>'`, and keeps the folder; it counts toward the keep budget and goes at its keep date like any kept folder.

## What it costs to change later

A constant: B is one branch in `saveJob`. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a save should be tried again on a later sweep: today a folder kept after a failed save is never saved again, and goes at its keep date (author)
