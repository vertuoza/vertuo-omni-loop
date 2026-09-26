---
id: s2-03-ask-colours-stay-out-of-the-shared-stylesheet
prd: 141
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Should the reading page's light and dark colours be written into the library's shared stylesheet too?

## The decision, in plain words

Not yet. Their values and their contrast test now live in the library, but the page still turns them into styles itself, because its light and dark switch works that way.

## The intro, for fun

The reading page's colours moved into the library, and kept their own light switch.

## The punchline, for fun

Rewiring a light switch nobody asked about is how fuses blow.

## The options, in plain words

A. Keep the reading page's colours out of the shared stylesheet, the option built.
B. Generate them into the shared stylesheet under the page's light and dark selectors, and drop the page's own writer.

## What I had to decide

Whether the shared stylesheet the library generates carries the reading page's light and dark colours, or only the game's.

## What I did meanwhile

The shared stylesheet declares the game's colours and the named colours; the reading page's colours come from the library and are written as styles by the page, exactly as before.

## What it costs to change later

Adding them to the shared stylesheet later is a change to the generator and to the page's layout, with no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec wanted one stylesheet for every surface, or one source of values (author)
