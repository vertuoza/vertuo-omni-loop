---
id: s13-01-plan-targets-readers-allowlist
prd: 2011
slice: s13
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

The guard that keeps the old plan-repository list of repositories out of the loop's commands allows the plan repository's own commands and checks beside the code that finishes records born in the repository. Is that the right line?

## The decision, in plain words

Only the two commands the slice named, next and care, were moved off the list. The plan repository's own commands and checks stay allowed, each named with its reason in the guard test, so the old way keeps working untouched.

## The intro, for fun

A guest list is only useful if someone checks the door.

## The punchline, for fun

Sixteen names are on it, and each now says why.

## The options, in plain words

A. A. Allow the plan repository's own commands and checks as listed, each with its reason (built)
B. B. Allow only the record-finishing code, and move every other reader behind the shared reader in a follow-up slice

## What I had to decide

Answer A to keep the allowlist as built (it can only shrink: a file that stops reading the list must leave it). Answer B to name only the record-finishing code and move board, flow, kb, plan, product, sync and the grades behind a shared reader in a follow-up slice.

## What I did meanwhile

next and care read the list through one small reader file that imports types only, so the loop's path stays free of gh reads; the guard test lists every other reader and fails on a new one.

## What it costs to change later

B touches about ten files outside this slice's territory and risks the plan-repository path the person decided to keep.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which commands count as the code that finishes records born in the repository, beyond roadmap push, omni bug's Fixes check, knowledge copies and copy-flow (author)
- A new file, kit/lib/plan-repo/target-list.ts, sits outside the slice's territory; it was needed because the existing targets reader pulls gh reads onto the loop's path (author)
