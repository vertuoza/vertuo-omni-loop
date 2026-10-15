---
id: s1-02-sync-record-shape
prd: 1990
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

What should the saved sync result hold, so the session's start and the status line can show the same block without checking again?

## The decision, in plain words

The saved result keeps two more things than the spec lists, the newcomer's checklist and the fix line, and keeps each finding of a check on its own, so any later reader prints the same block from the saved copy alone.

## The intro, for fun

The spec listed five fields, and the block needed seven.

## The punchline, for fun

A copy that can't be printed is only half a copy.

## The options, in plain words

A. Keep the two extra fields and one entry per finding, so every reader prints from the saved copy alone.
B. Keep exactly the five fields of the spec, one entry per check, and rebuild the checklist and fix line by checking again.
C. Keep the five fields, and store the printed block as text beside them.

## What I had to decide

Spec section 4 lists checkedAt, status, headline, setupDoneAt and findings, one entry per check. Slice s5 must print the whole block from the cache, and the block also shows the newcomer's four steps and the fix line, which the five fields cannot rebuild. I added setup (the steps while blue, null otherwise) and fix (the fix line's text, null when none). A check with several findings (on another branch and with changed files) keeps one entry per finding, each with its check; a check with nothing to say keeps one green entry, and a check whose level is off keeps one entry reading off. The printed block shows a check's findings that are not green, each on its own line, else its green one. Status is stored as blue, red, orange or green, and the green check line reads in sync.

## What I did meanwhile

kit/lib/sync/schema.ts defines the record; kit/lib/sync/render.ts prints it; omni sync --json prints it as the cache holds it.

## What it costs to change later

The file lives only in the local folder no one commits, and a file of another shape reads as absent and is rewritten: changing the shape later costs one run, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Slices s5 and s6 read this shape; if a person picks another one, they follow it (author).
