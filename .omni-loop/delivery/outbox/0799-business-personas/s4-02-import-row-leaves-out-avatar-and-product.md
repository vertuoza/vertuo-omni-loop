---
id: s4-02-import-row-leaves-out-avatar-and-product
prd: 799
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Must the file spell out every persona's portrait numbers and product, and may it name a trade the page cannot draw?

## The decision, in plain words

A row may leave out its portrait, and one is picked for it the same way every time; with one product, it may leave out the product too. The trade must be one the page can draw.

## The intro, for fun

Nobody wants to type five portrait numbers per persona by hand.

## The punchline, for fun

So the import picks a face for you, and only trades the page can actually draw get in.

## The options, in plain words

A. A. Portrait and product optional (one product only), trade limited to the drawable ones.
B. B. Every field required in every row.
C. C. Portrait optional, and any short lower-case trade the database accepts.

## What I had to decide

Whether the portrait and the product are required in every row, and whether the trade is limited to the ones the page draws.

## What I did meanwhile

A missing portrait is picked from the product and the name; a missing product means the only product; a trade outside the drawable list refuses the file.

## What it costs to change later

A constant change in the import script.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists the portrait among the checked fields but does not say whether a file must carry it. (author)
