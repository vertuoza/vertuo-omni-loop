---
id: s1-02-shared-branch-verdict-shell
prd: 686
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new concept check was a near copy of the bug and visual fix checks, so the repository's quality gate refused every commit. Should the three checks share one piece of code, even though that changes the older two?

## The decision, in plain words

The concept, bug and visual checks, and the phase-0 check, now share one piece of code for reading the branch and printing the verdict. Their behaviour and their messages stay the same.

## The intro, for fun

Three checks walked in wearing the same outfit, and the gate would not let them through.

## The punchline, for fun

Now they share one wardrobe and each keeps its own hat.

## The options, in plain words

A. A. Share one shell and one set of folder and page checks across the four commands and three verdicts, the option built.
B. B. Share them only between the concept check and a new helper, leaving bug and visual as they were; the gate still counts the copies they hold of the helper as new.
C. C. Add the concept check's copies to the gate's baseline so the gate stops counting them.

## What I had to decide

Whether the wave's fix for the duplication and complexity gate may refactor `omni bug`, `omni visual` and `omni phase0`, which no slice owns, onto a shared `kit/bin/branch-range.mjs`, and move the folder finder and raster check into `kit/lib/fix-verdict.mjs`.

## What I did meanwhile

Added `kit/bin/branch-range.mjs` (the base ref, the range's commits and paths, and the `omni <verb> <n> [--base <ref>]` shell); `concept`, `bug` and `visual` are each one call to it, and `phase0` reuses its base and commit readers. `numberedFolders` and `rasterFaults` moved into `kit/lib/fix-verdict.mjs`. The concept verdict's `folderFaults` and `networkLoads` and the Areas parser were split into smaller functions. Every message and exit code is unchanged, and each command's tests pass as they were.

## What it costs to change later

Reverting it means copying the helpers back into four command files and three verdicts, and the gate refusing commits again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The gate's own thresholds were read from its findings, not from a written rule in this repository (author).
