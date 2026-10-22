---
id: s4-02-shell-one-boundary-no-part-skeletons
prd: 2401
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

A PRD's page now shows its frame before its approval, its send-to-terminal buttons and the runner that is fixing it are known, but the frame has no placeholder for those three parts, and they come in together rather than one by one. Should each part get its own placeholder and its own wait?

## The decision, in plain words

The page is sent first without the approval block, the send buttons and the fixing line, and the whole page is sent again with all three once they are read; an approval block is left out of the first frame instead of saying it could not be read.

## The intro, for fun

The stage is set and the actors are still in make-up.

## The punchline, for fun

A part that arrives late should at least leave a chair.

## The options, in plain words

A. A. One waiting place for the three late parts, the frame drawn without them (as built).
B. B. One waiting place and one placeholder for each of the three parts, in a follow-up slice that owns the page's files.

## What I had to decide

One waiting place for the three parts together, around the same page drawn without them, because the page's own file (DossierPage) and the stream's file are outside this slice's ground. A page change that draws a placeholder for each part, and one waiting place each, belongs to a slice that owns those files.
Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

The frame, the tabs and the shown version reach the person as soon as the database has answered; the three parts follow in one piece.

## What it costs to change later

Moving to one waiting place per part changes the page's files and its render tests, not the reads: a day of work, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Each part with its own skeleton is not drawn: the files that draw the page are outside the slice's territory (author).
