---
id: s6-02-share-card-headline-face
prd: 261
slice: s6
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The picture a shared link shows cannot use the page's own lettering. Which lettering should its headline use?

## The decision, in plain words

The headline is drawn in the picture tool's plain built-in lettering, large, yellow and slanted, while the logo above it keeps its pixel art.

## The intro, for fun

The poster's lettering showed up in a format the printer cannot read.

## The punchline, for fun

So the headline wears plain type, and the logo still wears its pixels.

## The options, in plain words

A. Draw the headline in the renderer's built-in lettering, the option built.
B. Add a copy of the display lettering in a format the picture tool reads, and draw the headline in it.
C. Draw the headline as pixel art, the way the crest is drawn.

## What I had to decide

Next's image renderer reads fonts as TTF, OTF or WOFF only, and `@omni/design` ships its faces as WOFF2 only (`packages/design/fonts/`), so the `display` role cannot draw JOIN THE LOOP! in the Open Graph image.

## What I did meanwhile

The card draws the crest's `full` form from `logoSvg` (pixel-exact) and the kicker and JOIN THE LOOP! in the renderer's built-in sans (Noto Sans), yellow, skewed -10°, with an ad-purple drop shadow, all colours from `COLOURS`. Checked by rendering the PNG from `pnpm build`.

## What it costs to change later

A few lines: load a TTF/WOFF copy of the display face in `app/opengraph-image.tsx` and pass it to `ImageResponse`'s `fonts`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person finds the built-in sans off-brand next to the pixel crest (author)
