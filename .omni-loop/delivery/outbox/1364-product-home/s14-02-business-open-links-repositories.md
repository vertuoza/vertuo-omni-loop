---
id: s14-02-business-open-links-repositories
prd: 1364
slice: s14
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

When a workspace opens its business for the first time, should its repositories still be put in the first product, now that products are optional?

## The decision, in plain words

Yes: opening the business still puts every repository that is in no product into the first product, as it did before, now as a link.

## The intro, for fun

The first product opens its doors and every stray repository walks in.

## The punchline, for fun

Same welcome as before, just with a guest list now.

## The options, in plain words

A. Link every repository in no product to the first product, as before, the option built.
B. Link nothing: a workspace's repositories stay in no product until someone links them.

## What I had to decide

What business_open() does with the workspace's repositories once it can no longer write repositories.product_id.

## What I did meanwhile

It links each repository of the workspace that has no link to the first product (added_by person), which is what the column write did through the s1 trigger.

## What it costs to change later

One statement in business_open(); a later migration can remove it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's rule that a new repository gets no product was meant to cover opening the business too (author)
