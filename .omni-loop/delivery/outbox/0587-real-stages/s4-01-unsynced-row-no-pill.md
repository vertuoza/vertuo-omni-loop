---
id: s4-01-unsynced-row-no-pill
prd: 587
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

On the PRD list, what should a numbered PRD show before its first sync has recorded any stage?

## The decision, in plain words

It shows no stage pill and is not counted in the stage bar until the sync records a stage for it.

## The intro, for fun

Brand new PRD, freshly numbered, and the sync has not had its coffee yet.

## The punchline, for fun

For up to fifteen minutes it simply wears no badge at all.

## The options, in plain words

A. Show nothing until the first sync (built): The row has no pill and counts nowhere; the numbers always add up to what is stored.
B. Show a Syncing pill: Matches the PRD page's header; the bar still skips it.
C. Count it as PRD: A numbered PRD has an issue, so PRD is safe to assume; the count may run ahead of the database.

## What I had to decide

Whether a numbered PRD with no stored stage shows nothing, a Syncing pill, or counts as PRD on the list.

## What I did meanwhile

Such a row shows no pill and the seven counts skip it; the PRD page itself still reads Syncing.

## What it costs to change later

A constant in the list's stage rule and one test; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec says each row shows its current stage and says nothing of a row not synced yet (author)
