---
id: s12-01-arcade-cast-ceiling
prd: 976
slice: s12
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the PRD page's findings removed two type escapes the earlier clean-up had counted, and that count lives in a shared file outside this slice's ground. Who lowers it?

## The decision, in plain words

This slice lowered the arcade's count of type escapes by the two it removed, so the existing check stays exact and green.

## The intro, for fun

Two escape hatches were sealed, and the ledger that counts them sits on someone else's desk.

## The punchline, for fun

The slice wrote the new number down itself rather than leave the ledger wrong.

## The options, in plain words

A. This slice lowers the arcade's type-escape count by the two escapes it removed.
B. Keep the two removed escapes as they were, leaving two lint findings in this area.
C. Leave the count as it was and let the wave's merge lower it once for every slice.

## What I had to decide

Whether a slice may lower the arcade's shared count of type escapes when its own fixes remove some, though that file is outside its ground.

## What I did meanwhile

The arcade's count in the type-escape ceiling file went from 153 to 151; nothing else in that file changed.

## What it costs to change later

A constant: one number in one file. Sibling slices of the same wave that remove escapes lower the same line, so merging them one by one may need that number recomputed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives each slice its own lint ceiling file, but names no owner for the older type-escape ceiling file, which fails below its count as well as above (author)
