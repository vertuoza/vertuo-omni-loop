---
id: s1-01-kb-index-json-lists
prd: 2299
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

When the session-start knowledge block is cut to fit its size cap, should the machine-readable form list only the items the block shows, or every item the page holds?

## The decision, in plain words

The machine-readable form lists only the items the block shows, and a separate count says how many were left out of each list.

## The intro, for fun

A list that has to fit in a small box must choose what to leave out.

## The punchline, for fun

Here it leaves out the tail and says how much, so nothing disappears quietly.

## The options, in plain words

A. A. The lists are the items the block prints, cut says how many were left out (built).
B. B. The lists hold every item the page sent, cut says how many the text block left out.

## What I had to decide

The spec says --json prints { state, product, words, legal, personas, syncedAt, cut } but not whether the lists are whole or as printed. Built: the lists are the printed items, cut holds the counts left out. Changing to whole lists is a one-line change in kit/lib/product/index.ts.

## What I did meanwhile

Anything reading the machine-readable form sees the same items as the text block.

## What it costs to change later

A reader that wants every item must run omni kb glossary or omni kb legal instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the machine-readable lists are whole or as printed (author)
