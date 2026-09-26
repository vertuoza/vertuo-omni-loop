---
id: s7-01-logo-minimum-sizes-and-grounds
prd: 141
slice: s7
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

How small may the Omni Loop logo be drawn, and which version of it goes where?

## The decision, in plain words

Each version is never drawn smaller than its own pixel size, and below that the tab icon or the written name takes over. The full logo is the default and goes on dark backgrounds, while the single dark ink version is for light ones.

## The intro, for fun

The logo got a rulebook. Somebody had to say how tiny is too tiny.

## The punchline, for fun

Below sixteen pixels, even a loop arrow gives up and just writes its name.

## The options, in plain words

A. Never below 1x, the favicon below the mark, text below 16 pixels, as documented (the option built).
B. A larger floor for the wordmarks, 2x for full and lockup, so the 5x7 letters stay legible on high-density screens.
C. Enforce the floor in code: the logo module refuses a scale below a per-form minimum.

## What I had to decide

The minimum size of each logo form and which form and variant goes on which ground, which the spec asks the package's documentation to state but does not settle.

## What I did meanwhile

The package's documentation sets the minimum at 1x for every form (full 122x18, lockup 140x32, mark 20x18, favicon 16x16 and its whole multiples), sends anything smaller than the mark to the favicon and anything under 16 pixels to the name written in the pixel face, and assigns full as the default, lockup to posters and ads, mark to square spots, favicon to tabs; the full-colour crest on dark grounds, the one-colour variant on light grounds or single ink.

## What it costs to change later

Documentation only: changing a minimum or a placement rule is an edit to the package's documentation. No code enforces these sizes, so nothing else moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names 'the minimum sizes' among the brand rules but gives no numbers; no knowledge entry or ADR sets them.
