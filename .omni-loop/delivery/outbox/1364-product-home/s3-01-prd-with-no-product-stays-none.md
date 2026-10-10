---
id: s3-01-prd-with-no-product-stays-none
prd: 1364
slice: s3
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When a PRD has been set to no product, but its repository belongs to exactly one product, whose approvers, claims and personas does it read?

## The decision, in plain words

The PRD's own choice wins: a PRD with no product reads none, so any member approves it, even when its repository belongs to one product. Only a call that names no PRD, or one the server does not hold, falls back to the repository's only product.

## The intro, for fun

The form has a box marked No product, and somebody ticked it on purpose.

## The punchline, for fun

So the server believes the box instead of guessing from the address.

## The options, in plain words

A. A PRD with no product reads none, and any member approves it, the option built.
B. A PRD with no product falls back to its repository's only product, so that product's approvers decide.
C. Fall back only for a PRD born before its repository joined a product, and keep none when a person picked No product.

## What I had to decide

Whether a PRD whose product is none falls back to its repository's only product in the lookups, or stays with none.

## What I did meanwhile

Every lookup that knows its PRD reads that PRD's product, none included; a call without a PRD, or for a PRD the server does not hold, reads the repository's only product, else none.

## What it costs to change later

One line in the shared lookup function; switching to the fall-back changes no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists PRD, then repository, then none, but does not say whether a PRD with no product counts as having answered
- (author) A PRD only has no product in a one-product repository when a person picked No product on its page, or when the repository joined the product after the PRD was born
