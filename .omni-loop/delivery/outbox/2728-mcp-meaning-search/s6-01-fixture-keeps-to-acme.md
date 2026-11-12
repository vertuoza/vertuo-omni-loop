---
id: s6-01-fixture-keeps-to-acme
prd: 2728
slice: s6
rank: medium
bears-on: never#11
raised: 2026-11-12
wave: 3
---

## The question, in plain words

The example questions and the guide's examples had copied a real customer's question and rule number. Should the examples be about a made-up shop instead?

## The decision, in plain words

They are now about Acme, a made-up online shop: orders, stock and accounts. Nothing in them comes from a real product.

## The intro, for fun

The eval needed a product to quiz.

## The punchline, for fun

So it got a shop that sells nothing to nobody.

## The options, in plain words

A. Made-up Acme questions and ids (built).
B. Keep the real product's questions, which this open-source code base must never hold.

## What I had to decide

The fixture `scripts/eval-search/acme.json` and the examples in `docs/guide/api.md` used `BL-QUOTES-1`, `SIREN` and a question written for one real product's eval. They now use `BL-ORDERS-1`, `term:SKU` and Acme questions (never#11).

## What I did meanwhile

The fixture and the guide hold Acme examples only; the eval script and its tests are unchanged and green.

## What it costs to change later

Editing one JSON file and a few lines of the guide.

## What I could not know

Whether the demo seed should hold matching Acme knowledge, so a preview can be scored with this fixture (author).
