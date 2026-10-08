---
id: s2-02-record-new-shape-only
prd: 1208
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Should the note of what a session works on still be readable by an older kit after a rollback?

## The decision, in plain words

The note is now written only in its new form. An older kit reads a feature note in the new form as nothing until the next command writes one in the old form.

## The intro, for fun

The new notebook has nicer lines, but grandpa's glasses only read the old ones.

## The punchline, for fun

Grandpa squints for exactly one command.

## The options, in plain words

A. A. Write the new form only (built).
B. B. Also write the old field on feature notes, so an older kit still reads them after a rollback.

## What I had to decide

Pick A to keep the new form only, or B to also write the old field for features so an older kit keeps reading them.

## What I did meanwhile

Every note is written as a kind and a number; old notes are still read.

## What it costs to change later

Adding the old field back is one line where the note is written, plus its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's rollback risk says an older kit ignores the new fields, while its record shape names only kind, number and time; the two were not reconciled (author).
