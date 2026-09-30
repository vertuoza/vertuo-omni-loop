---
id: s4-01-add-a-product-is-the-one-mention
prd: 748
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 4
---

## The question, in plain words

While a business sells one thing, the page must never talk about products, yet the button that adds a second one has to say something. What should that button say?

## The decision, in plain words

The button says "+ Add a product", as the spec names it, at the foot of the page. It is the only place the word shows while there is one; the tabs and every other mention appear only from the second one on.

## The intro, for fun

A page promised never to say a word, except the one word it needs to break the promise.

## The punchline, for fun

So it whispers it once, at the very bottom, and hopes nobody reads that far.

## The options, in plain words

A. A. "+ Add a product" is the one mention, at the page's foot, the option built.
B. B. Other words with no "product" in them, such as "+ Sell something else".
C. C. Hide the button behind a Settings link until someone asks for it.

## What I had to decide

Whether the one button that adds a second product may say "product" while there is one, or needs other words.

## What I did meanwhile

The Business page shows a quiet "+ Add a product" button below the payoff card while there is one product; nothing else on the page or on Settings › Repositories says product. The render test checks that text without that one button never says product.

## What it costs to change later

One constant in the business view and its render test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the button "+ Add a product" and also says nothing mentions products while there is one; it does not say which wins.
