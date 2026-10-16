---
id: s16-01-product-prd-is-no-draft-in-the-list
prd: 2011
slice: s16
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

In Work › PRDs, a product PRD such as `mobile-12` has no repository number. Should the list show it by its own id and count it as a PRD, not as a draft?

## The decision, in plain words

The list heads a product PRD, and a product bug or roadmap in their lists, by its id, and a product PRD is no longer shown as a draft. The "Draft" and "PRD" state filters still read the repository number, so a product PRD still counts as a draft there.

## The intro, for fun

A PRD with a name tag, sitting in the draft pile.

## The punchline, for fun

It keeps its name tag; the pile is a separate fix.

## The options, in plain words

A. Show the id and no draft badge; leave the state filter as it is (as built)
B. Also teach the state filter that a product PRD is numbered
C. Leave product PRDs under DRAFT

## What I had to decide

How far to go in the list for a PRD without a repository number.

## What I did meanwhile

Built A. The row's product name sits beside its title on /prd, /bugs and Concepts. The ids come from `products.key` and `dossiers.product_seq`, read as the viewer (src/product-filter/), with no migration.

## What it costs to change later

Small: the state filter reads `row.prd`; B passes it the labels too.
