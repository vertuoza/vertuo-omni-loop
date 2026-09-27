---
id: s2-02-existing-note-kept-at-ship
prd: 262
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

When the loop reaches the moment to ship and a release note is already there, perhaps edited by the reviewer, should it keep that note or write a fresh one from what was built?

## The decision, in plain words

It keeps the note already there and only fixes what the check refuses, so a person's edits are never overwritten. The rework path is the one place that rewrites a note, when a rework changed what the feature does.

## The intro, for fun

Somebody already wrote the headline, and the loop arrives with its own pen.

## The punchline, for fun

The loop puts its pen away and only fixes the spelling the check points at.

## The options, in plain words

A. Keep a note already there, and fix only what the check refuses: the option built.
B. Always write the note afresh from the spec and the built branch, overwriting any note already there.
C. Keep a note a person edited, but rewrite one the loop wrote in an earlier run.

## What I had to decide

What `/omni:yolo` step 5 does when the PRD's folder already holds `release.md` before `omni ship`: a person wrote or edited it on the feature branch, or an earlier run committed it and then stopped before the ship. The spec says yolo writes the note from the spec and the built branch, and that `/omni:yolo-fix` rewrites an existing note when a rework changed what the PRD does; it does not say what yolo does with one already there.

## What I did meanwhile

`/omni:yolo` step 5, item 1: none there, it writes one; one there, it keeps its words and changes only what `omni check releases` refuses, and a kept note that did not change needs no commit. `/omni:yolo-fix` step 7 adds the rewrite when a merged rework changed what the PRD does.

## What it costs to change later

One sub-bullet of `/omni:yolo` step 5 and a line of its porting note. No code, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reviewer ever edits the note on the branch before the loop ships, rather than after, is not known yet: the note is new.
