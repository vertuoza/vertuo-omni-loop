---
id: s3-01-tsgo-fix-in-care-state
prd: 1042
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The faster type checker refused one file, and the fix could not be made where the plan said, so it was made in the file next to it. Is that fine?

## The decision, in plain words

The fix went into the file that describes the shape of the pull request data the care command reads, not into the care command itself. Nothing the command does changed.

## The intro, for fun

The plan said fix it in the kitchen, but the leak was in the pipe next door.

## The punchline, for fun

So the plumber fixed the pipe and left the kitchen exactly as it was.

## The options, in plain words

A. A. Keep the fix in the care data shape file: its outer three levels written out and checked by the compiler against the schema
B. B. Keep the old checker for typecheck and leave the new one out until it no longer trips on this file
C. C. Move the care data shape into the care command's own folder so the fix sits inside the slice's ground

## What I had to decide

Whether the fix to the care data shape, one file outside this slice's ground, may stay where it is.

## What I did meanwhile

The new checker and the old one both pass, and agree error for error on a test with deliberate mistakes. The care command's code and tests are unchanged.

## What it costs to change later

Moving it back is impossible without a cast; undoing it is reverting a six-line type change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The new checker's error depends on the order it checks files in: with one checker thread it never shows, with four or more it does, and even a call with an empty argument in another file triggered it. So no change in the care command alone could fix it; the type of the data shape itself had to be written out.
