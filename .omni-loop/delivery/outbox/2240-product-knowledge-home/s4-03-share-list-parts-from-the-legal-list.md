---
id: s4-03-share-list-parts-from-the-legal-list
prd: 2240
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

The Constituents and Personas lists need the same card, filters and text cell as the Legal list, so should they reuse them, which means exporting three pieces from a file an earlier slice owns?

## The decision, in plain words

This slice added the word export to three small pieces of the Legal and Glossary list file and reused them, rather than copying forty lines into its own folder.

## The intro, for fun

Two new lists asked to borrow a cup of sugar instead of buying a farm.

## The punchline, for fun

The cupboard door now says export, and nothing else in the kitchen moved.

## The options, in plain words

A. Export the three pieces from the Legal and Glossary list file and reuse them (built).
B. Copy the three pieces into this slice's folder, which the repository's duplication check refuses.

## What I had to decide

The repository's duplication check refuses a forty-line copy of the card, the filters and the one-line cell. The three pieces live in KnowledgeLists.tsx, outside this slice's territory (slice s3 owns it). I exported them there (three keywords, no other change) and imported them in the new sections. The alternative was a copy inside this slice's folders, which the check refuses.

## What I did meanwhile

The Legal and Glossary lists draw exactly as before; the Constituents and Personas lists draw with the same pieces.

## What it costs to change later

Undoing it is removing three export keywords and copying the pieces into this slice's folder, about forty lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Slices s5 and s6 may want the same pieces for their own pages; nothing here stops them (author)
