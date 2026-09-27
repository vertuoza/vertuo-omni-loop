---
id: s2-01-game-mode-on-a-phone
prd: 238
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

On a phone, the top bar of the questions and knowledge pages no longer fits on one line once Game mode joins it. Where should Game mode go?

## The decision, in plain words

The bar folds onto one more line, and Game mode takes the right end of it, just under the light and dark switch. Nothing else in the bar moves, and the page never scrolls sideways.

## The intro, for fun

Game mode reached the top bar on a phone, and every seat on the first row was taken.

## The punchline, for fun

So it took the corner seat one row down: still on the right, still the last.

## The options, in plain words

A. It folds under the light and dark switch, at the right end of its line, the option built.
B. It moves up beside the Omni Loop name, and the page's other links fold under it.
C. It folds to the left of its own line, as the other links do when they fold.

## What I had to decide

Where Game mode sits in the /ask header and the /knowledge bar when they wrap on a narrow screen.

## What I did meanwhile

In src/ask/ask.css the header's end (.ask-bar-end) now wraps, which also removes the 114 px sideways scroll Game mode caused at 393 px, and Game mode takes margin-left: auto there and in the /knowledge bar (src/knowledge/knowledge.css), so on a row of its own it sits at the right end, under the theme switch. src/switch/headers.test.ts pins both rules.

## What it costs to change later

Two CSS rules and their test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec puts Game mode at the top right and says that on a phone it keeps its glyph and its words; it does not say where it goes when a header wraps.
- (author) /app's header (s1) puts Game mode beside the theme switch on its second row, at the left: there the two share a row, so the question does not come up.
