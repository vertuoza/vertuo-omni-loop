---
id: s2-01-pixel-palette-stays-in-its-file
prd: 141
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Should the pixel colours move into the new colour module, or stay where the sprites already read them?

## The decision, in plain words

They stay where they were. The new colour module reads them from there and publishes them with everything else, so there is still one place to change a colour.

## The intro, for fun

Every colour now has one home. The pixel colours kept their old room in it.

## The punchline, for fun

Moving house mid-wave, while the sprite painters work next door, felt rude.

## The options, in plain words

A. Keep the palette file, read by the tokens module, the option built.
B. Move the palette and named colours into the tokens module, and point the sprite code at it once the sprite poses slice has merged.

## What I had to decide

Whether the pixel palette and the named colours live in the palette file or move into the tokens module the spec names.

## What I did meanwhile

The palette file keeps the pixel palette and the named colours, including the six new ones; the tokens module imports them, adds the arcade's own and Ask's colours, and writes the stylesheet. One place still defines each colour.

## What it costs to change later

Moving the two tables into the tokens module later is a file move and a few import lines in the package; nothing outside it changes, since everything is read through the package's index.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's module table meant a physical file or a group of exports (author)
