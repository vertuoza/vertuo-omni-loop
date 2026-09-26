---
id: s3-03-type-scale-values
prd: 141
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The design names eleven text sizes but gives no numbers, and says they belong in the colour sheet. What sizes, and where do they live?

## The decision, in plain words

Headlines run from 96 down to 32, game text keeps the sizes the arcade already uses, and reading text centres on the 17 Ask already uses. They sit in the font sheet beside the fonts they name, not in the colour sheet.

## The intro, for fun

Eleven text sizes were named, and not one of them came with a number.

## The punchline, for fun

So we measured what the game already wears and tailored the rest to fit.

## The options, in plain words

A. The sizes above, in the font sheet beside the faces, the option built.
B. The same sizes, moved into the colour sheet.
C. Different sizes, chosen once the home page draws its first headline.

## What I had to decide

The size, line height and slant of each type-scale step, and whether the scale's custom properties go in fonts.css or tokens.css.

## What I did meanwhile

Display 96, 72, 48 and 32 leaning 12 degrees; pixel 16 and 8 in Press Start 2P and 20 in Jersey 10; body 20, 17 and 14; mono 15. All written by the fonts module into fonts.css, since tokens.css belongs to the colour slice.

## What it costs to change later

A constant per step, and one generator line to move the properties to tokens.css.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- no page uses the display steps yet, so their sizes are unchecked against a real layout (author)
- the spec says the scale lives in tokens.css; that file was outside this slice's territory (author)
