---
id: s12-02-other-filters-drop-the-product
prd: 1364
slice: s12
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When a person picks a product and then changes another filter on a list (search, mine or all, repository, state), should the product choice stay?

## The decision, in plain words

The product links keep every other filter, but the existing filters, whose forms live outside this slice, do not yet carry the product: changing one of them shows all products again.

## The intro, for fun

The new filter remembers its friends, but its friends have not learned its name yet.

## The punchline, for fun

So picking a repository forgets the product, until the old forms are taught one hidden field.

## The options, in plain words

A. A. The product links keep the other filters; the other filters reset the product (built).
B. B. Teach the history and fix list forms to keep the product too, a follow-up change outside this slice.
C. C. Remember the product choice in a cookie for every list.

## What I had to decide

Whether the existing list filters must carry the product choice, which means changing the history and fix list forms outside this slice.

## What I did meanwhile

The product filter is a row of links above each list, each one the list's address with its other filters kept. The search, Mine or All, repository and state forms in DossierHistory.tsx and FixList.tsx are untouched, so they drop the product parameter.

## What it costs to change later

One hidden product field in each of the two forms and the product kept in their Mine, All and Clear links.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks only for a product filter on each list; it does not say how it combines with the others.
