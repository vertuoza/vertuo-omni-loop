---
id: s3-01-when-rivals-are-guessed
prd: 748
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

How often should the business page ask for guessed rivals, since each ask costs one call to the model?

## The decision, in plain words

It asks once the three picks are in, and again only when one of them changes. A later visit with guesses still waiting to be answered does not ask again.

## The intro, for fun

The page wanted to guess our rivals every time we walked past.

## The punchline, for fun

We asked it to wait until we changed our answers.

## The options, in plain words

A. Ask when the picks change, and on a visit with no guess waiting, the option built
B. Ask on every visit with the three picks in
C. Ask only the first time the three picks are complete, never again

## What I had to decide

When Settings › Business calls the suggest-rivals route: on every visit with the three picks in, or only when the picks change.

## What I did meanwhile

The page asks when offering, trade and region are confirmed and their key differs from the last one asked in this visit. On load, the key counts as asked when a proposed rival is already waiting, so a reload with guesses pending costs nothing. A visit with no guess waiting asks once. The route reads the picks from the database itself rather than trusting the page, and drops every rival the business already holds in any state.

## What it costs to change later

A few lines of the effect in apps/galaxy/src/business/BusinessPage.tsx; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the server asks once offering, trade and region are picked, and names one model call per suggestion request as the cost, but not whether a revisit asks again
