---
id: s2-01-product-key-from-which
prd: 3007
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The terminal asks the Omni page which product this repository is in, and the page answers with the product's name, not its short key. Which key should the knowledge search use when this checkout has not named a product?

## The decision, in plain words

When the checkout remembers no product, the search turns the product's name into a key by lowercasing it and joining its words with dashes, so Omni Loop becomes omni-loop. A checkout that named its product with omni product use always uses that key.

## The intro, for fun

A product has a name for people and a key for machines.

## The punchline, for fun

Today the terminal has to guess the machine one.

## The options, in plain words

A. A. Rewrite the name as a key, and prefer the key the checkout remembers
B. B. Add the product's key to the page's answer, in a change to the page
C. C. Ask the person to run omni product use <key> before the first search

## What I had to decide

The route takes the product's key and omni product which answers names only. Rewriting the name is a constant to change, not a migration, and a wrong guess prints the knowledge-off line, never a wrong answer.

## What I did meanwhile

A product whose key is not its name in lower case reads the knowledge-off line until its checkout runs omni product use <key>.

## What it costs to change later

If the page later answers the key beside the name, the rewriting is deleted in one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the products read of the Omni page should carry the key (author)
