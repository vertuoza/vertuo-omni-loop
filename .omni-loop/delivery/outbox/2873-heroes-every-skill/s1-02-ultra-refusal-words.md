---
id: s1-02-ultra-refusal-words
prd: 2873
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

What should the Runners page say when someone sends a multi-repository build from a repository that has no plan repository to point to?

## The decision, in plain words

It says the build runs from a product's plan repository and that this repository is no product's plan repository. When the repository's product has a plan repository, it names it instead, and names each one when several products hold the repository.

## The intro, for fun

Sometimes there is no plan repository to send the person to.

## The punchline, for fun

No map, so the sign just says you are not at the harbour.

## The options, in plain words

A. A. Say the repository is no product's plan repository, and name every plan repository of the products that hold it (built).
B. B. Also tell the person where to set a product's plan repository, in Products › Repositories.
C. C. Name only the first plan repository when several products hold the repository.

## What I had to decide

The spec gives the words when the product has a plan repository (send it from that repository) but not when it has none, or when the repository is in no product, or in several products with different plan repositories. I also had to pick how the refusal is classed: I classed it with the other refused lines (a 400), as a repository's own skill it does not allow is.

## What I did meanwhile

Built the three cases: one plan repository named, several named with 'or' in name order, or the line saying the repository is no product's plan repository. Nothing is queued in any of them, from the page or from an API key.

## What it costs to change later

A constant: the words are one function in the service, and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec gives the words for a product with a plan repository; the other cases follow them.
