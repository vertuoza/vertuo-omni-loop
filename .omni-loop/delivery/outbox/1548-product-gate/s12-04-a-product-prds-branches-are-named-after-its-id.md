---
id: s12-04-a-product-prds-branches-are-named-after-its-id
prd: 1548
slice: s12
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

A product PRD has no folder name to build its branch names from. What name do its branches and its local copies of each repository take?

## The decision, in plain words

Its own name, like mobile-12, in place of the topic, so every repository's feature branch and every slice branch of that PRD carry it, and two PRDs never share a copy.

## The intro, for fun

Every branch needs a name tag, and this PRD only came with a number plate.

## The punchline, for fun

So the number plate went on every branch, which at least never gets lost.

## The options, in plain words

A. Name them after the PRD's id alone (built).
B. Add a short word from the title after the id.
C. Give the product PRD a topic field on its page and use that.

## What I had to decide

What fills the topic of a product PRD's feature and slice branches, and of its target clones.

## What I did meanwhile

The PRD's id fills the topic everywhere, for every repository it lands in.

## What it costs to change later

Renaming later means new branches for any PRD already being built; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether people want a readable word in the branch name beside the id (author)
