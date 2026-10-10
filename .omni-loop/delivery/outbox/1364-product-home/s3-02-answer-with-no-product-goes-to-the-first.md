---
id: s3-02-answer-with-no-product-goes-to-the-first
prd: 1364
slice: s3
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When a customer fact answered during a brainstorm finds no product, for a PRD with none or a repository in several products, where is it kept?

## The decision, in plain words

It is kept on the workspace's first product, as an answer in a repository with no product was kept before, because every fact other than a region must belong to a product.

## The intro, for fun

Every letter needs an address, even the ones nobody wrote one on.

## The punchline, for fun

Those go to the first house on the street, like they always did.

## The options, in plain words

A. Keep the answer on the workspace's first product, the option built.
B. Refuse the answer and ask the agent to name the product.
C. Let such facts belong to no product, which changes how facts are stored.

## What I had to decide

Where an answered customer fact that needs a product goes when the lookup finds none.

## What I did meanwhile

The answer takes the PRD's product, else the repository's only product, else the workspace's first product, the fall-back it had before for a repository with no product.

## What it costs to change later

One line in the answer function; facts already kept can be moved by a person on the business page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a lookup with no product behaves as it does today without one; today that is the first product for an answer, so the fall-back was kept, not chosen anew
