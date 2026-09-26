---
id: s5-04-boot-learns-the-crest-outside-its-ground
prd: 141
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

To draw the new logo on the opening screen, this slice changed a little of the game's main screen code, which sits outside the part it was given. Was that right?

## The decision, in plain words

Yes, with the smallest change possible: the main screen now passes along whether the logo should be drawn, and nothing else changes. No other slice was working on those files at the time.

## The intro, for fun

The opening screen had to know whose logo to draw, and nobody had told it.

## The punchline, for fun

One small note was passed through a door this slice was not meant to open.

## The options, in plain words

A. Carry the crest in the frame state, the option built.
B. Draw the boot's crest in the page layer above the canvas instead, inside the slice's own files, and leave the canvas black under the house brand.

## What I had to decide

Whether carrying the house brand's crest through the frame state, in the arcade's shared scene types and the arcade app, is acceptable outside the slice's territory.

## What I did meanwhile

An optional logo field on the frame state, set from the brand's look; every scene but the boot ignores it.

## What it costs to change later

Three lines in the arcade app and one field in the shared scene types; removing them puts the letter mark back on the boot.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the other slices of this wave or the next expected those files untouched (author)
