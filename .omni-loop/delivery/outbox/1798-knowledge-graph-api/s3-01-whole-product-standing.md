---
id: s3-01-whole-product-standing
prd: 1798
slice: s3
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

When someone asks about one rule or one legal entry, should the answer list every broken link and every repository of the product, or only those near what they asked about?

## The decision, in plain words

Every answer lists all the product's broken links and all its repositories, whatever was asked, so a reader always sees how complete and how old the whole graph is.

## The intro, for fun

Ask about one rule, and the answer hands you the whole product's report card.

## The punchline, for fun

Nobody can say they were not told the back-end never sent its homework.

## The options, in plain words

A. The whole product's lists in every answer (built).
B. Only the unresolved ids of the walked nodes, and every repository.
C. Only the walked nodes' unresolved ids and repositories.

## What I had to decide

Whether the read route's `unresolved` and `repositories` cover the whole product (as built) or only the neighbourhood walked.

## What I did meanwhile

productNeighbourhood (apps/galaxy/src/knowledge-graph/walk.ts) copies the joined graph's whole `unresolved` and `repositories` into every answer; only `nodes` and `edges` are the walk's. The page (s6) reads the same lists from the whole graph.

## What it costs to change later

Low: trimming `unresolved` to the walked nodes is one filter in walk.ts and its test; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's answer carries `unresolved` and `repositories` beside the walk without saying whether they are trimmed to it.
- A product with many unresolved ids sends them all in every answer; no product is that large yet (author).
