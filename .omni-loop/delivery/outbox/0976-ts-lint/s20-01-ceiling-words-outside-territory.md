---
id: s20-01-ceiling-words-outside-territory
prd: 976
slice: s20
rank: medium
bears-on: none
raised: 2026-10-02
wave: 5
---

## The question, in plain words

The last lint step changed two sentences outside its own folder: the team's checklist page and a note in the automatic checks, which still described the per-area limits that no longer exist. Is that fine?

## The decision, in plain words

Both sentences now say the linter fails on any problem at all. Nothing else in those two files changed.

## The intro, for fun

The limits were gone, but two notes still talked about them like old friends.

## The punchline, for fun

Two sentences rewritten, and nobody reads about a ghost anymore.

## The options, in plain words

A. A. Keep the two rewritten sentences (built).
B. B. Revert them and reword them in a separate change by whoever owns those files.

## What I had to decide

Keep the two rewritten sentences, or revert them and let the owner of those files reword them.

## What I did meanwhile

The checklist page and the checks note describe the linter as it now behaves.

## What it costs to change later

Reverting is two one-line edits; nothing depends on the wording.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives this slice the scripts folder and the root package file only; whether the checklist page and the checks note may be reworded by it was not settled (author).
