---
id: s2-01-header-bleed-by-negative-margin
prd: 498
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The plan says the PRD header has no margin, yet it sits inside the page's padding. How should it reach the top bar and both edges?

## The decision, in plain words

The header is pulled out by exactly the page's padding, so it touches the top bar, the sidebar and the right edge, while its title and tabs stay lined up with the content below.

## The intro, for fun

A header wanted to touch every wall of the room without moving the walls.

## The punchline, for fun

So it leaned out by exactly the width of the padding.

## The options, in plain words

A. Negative margins against the page padding: the gutter at the sides, 28 px at the top (built).
B. Drop the page's padding on the PRD page only, and pad the content under the header instead.
C. Declare the top padding as a shared setting too, and read it here.

## What I had to decide

Whether pulling the header out against the page padding is the right way, or the page padding should step aside on this page instead.

## What I did meanwhile

The header uses negative margins equal to the page gutter at the sides and 28 px at the top.

## What it costs to change later

A constant: if the page's top padding changes, the header's 28 px pull must follow it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The 28 px top pull copies .ask-main's top padding by hand; nothing ties the two together (author).
- No browser pass was run in this slice; the pinning and the absence of a sideways scroll at 390 px are unchecked (author).
