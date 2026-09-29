---
id: s4-02-stage-bar-inline-style
prd: 587
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Where should the look of the new stage bar on the PRD list be defined?

## The decision, in plain words

It reuses the pills of the PRD page and adds two small spacing and underline rules right in the list's own code, because the shared stylesheet belongs to another part of this work.

## The intro, for fun

The stage bar wanted a new outfit, but the wardrobe belonged to a sibling.

## The punchline, for fun

So it borrowed the pills and pinned two tiny notes on its own sleeve.

## The options, in plain words

A. Keep the two rules inline (built): No change outside this slice's files; the bar still looks like the page's pills.
B. Move them into the shared stylesheet: One place for every stage style; touches the file the PRD page owns.

## What I had to decide

Whether the bar's two rules (space under the bar, no underline on its links) move into the shared dossier stylesheet.

## What I did meanwhile

The bar looks like the PRD page's pill row, with the two rules written inline in the list's component.

## What it costs to change later

Moving two rules into the stylesheet in a later change; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the stylesheet to the PRD page slice; no rule says whether a list may add styles of its own (author)
