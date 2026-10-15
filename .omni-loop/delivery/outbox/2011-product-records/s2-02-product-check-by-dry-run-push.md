---
id: s2-02-product-check-by-dry-run-push
prd: 2011
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

How does the terminal learn which repositories belong to a product when it checks a roadmap, and who refuses a row outside the product?

## The decision, in plain words

The terminal asks the same roadmap route that takes a push, with a flag that writes nothing, and gets back the product's repositories. The route also refuses a row naming a repository outside the product, by name, so the rule holds even from a kit that skips the check.

## The intro, for fun

To ask who is in the product, knock on the door that already exists.

## The punchline, for fun

One door, two doors' worth of answers, and nothing written.

## The options, in plain words

A. A. Reuse the roadmap route with a check flag that writes nothing (as built)
B. B. Add a read of a product's repositories by key to the shared client and the products routes
C. C. Let the targets read take a key as well as a name, and use it

## What I had to decide

Whether to add a dedicated read for a product's repositories, which also needs a call added to the kit's shared client outside this slice, or to reuse the roadmap route with a check flag.

## What I did meanwhile

The roadmap route takes check: true and answers the product's repositories in short names without writing; the same route refuses a row outside the product with a 400 naming it. The existing targets read answers by product name, not key, so it was not used.

## What it costs to change later

A follow-up that moves the check onto its own read is one route and one client method; the body field is read by this route only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the check reads the product's repositories but not through which call.
