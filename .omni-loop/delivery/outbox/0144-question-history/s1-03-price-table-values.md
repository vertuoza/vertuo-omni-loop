---
id: s1-03-price-table-values
prd: 144
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The cost shown on each question comes from a price list the app keeps. Which prices, and what about a model the list does not know?

## The decision, in plain words

The list holds the public list prices per million tokens for current and recent Claude models, with cache reads at a tenth of the input price and cache writes at one and a quarter times it unless a model's own price says otherwise. A model not on the list shows no cost.

## The intro, for fun

Every question now wears a little price tag, like a sweater in a very thoughtful shop.

## The punchline, for fun

Tags for sweaters we have never seen stay blank.

## The options, in plain words

A. Public list prices per model, no cost for an unknown model
B. The same list, with an unknown model priced like the closest known family

## What I had to decide

Confirm the prices, and whether a model missing from the list should show no cost or a guess.

## What I did meanwhile

Costs are estimates for the models on the list, and blank for any other.

## What it costs to change later

Changing a price is editing one line of the list; nothing stored needs a migration, but costs already recorded keep the old price.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No billing source was checked for negotiated or partner prices; the list is first-party list prices (author)
