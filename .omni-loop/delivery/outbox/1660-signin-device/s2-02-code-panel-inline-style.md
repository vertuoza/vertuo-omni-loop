---
id: s2-02-code-panel-inline-style
prd: 1660
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The code check page draws the code large on a darker panel and has a box to type a code, but the shared stylesheet of these pages is not part of this piece of work. Where should those two looks live?

## The decision, in plain words

They are written on the page's own card, from the same colour and type tokens the stylesheet uses, so the page follows the three themes; moving them into the shared stylesheet later changes nothing a person sees.

## The intro, for fun

Two new looks arrived, and the wardrobe was locked.

## The punchline, for fun

They dressed from the same rail, just in the hallway.

## The options, in plain words

A. Inline styles on the card, from the shared tokens
B. Two named classes in the shared stylesheet

## What I had to decide

Keep the code panel and the code box styled on the card (A), or move them into the shared stylesheet as named classes (B).

## What I did meanwhile

Built as A: CODE_PANEL and CODE_BOX in src/ask/device-card.tsx, using --ask-mono, --ask-sunk, --ask-surface, --ask-ink and --ask-line-strong only.

## What it costs to change later

B is two classes in src/ask/ask.css and two className swaps, at any time.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- src/ask/ask.css is outside this slice's territory, so no class could be added there. (author)
