---
id: s1-02-ladder-step-set-by-owner
prd: 2011
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

Who moves a repository up or down the rollout ladder of its product, and how?

## The decision, in plain words

Every repository of a product starts at step one, and a workspace owner moves it to any step from one to five, up or down, the way they already edit the repository's other settings in the product.

## The intro, for fun

Five rungs, and somebody has to do the climbing.

## The punchline, for fun

For now the owner carries each repository up by hand.

## The options, in plain words

A. An owner sets any step from one to five, up or down (as built)
B. The step follows from what the repository has switched on, with no setter
C. An owner moves it one step at a time

## What I had to decide

Whether a workspace owner sets the ladder step by hand (built), or the step should follow from what the repository already has switched on, or only climb one step at a time.

## What I did meanwhile

product_repositories.ladder_step (1 to 5, default 1) is new, since no earlier PRD stored the ladder; product_repository_set_step(product, repository, step) lets an owner set it, refusing anyone else (42501), a step outside 1 to 5 (22023) and a repository the product does not link (P0002). Nothing reads the step yet: s2 and s6 read it to choose where a record is born, s17 shows it.

## What it costs to change later

A constant: the setter can be narrowed or replaced by a derived step in a follow-up migration; the column stays either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says when the archive is offered (every repository at step 5) but not who moves a repository between steps (author)
