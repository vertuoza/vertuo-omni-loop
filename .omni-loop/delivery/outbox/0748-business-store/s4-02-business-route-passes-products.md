---
id: s4-02-business-route-passes-products
prd: 748
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 4
---

## The question, in plain words

Showing one tab per product needs the Business page to receive the list of products, but the file that hands data to the page belongs to another piece of work. Should this piece of work touch it?

## The decision, in plain words

Yes, with the smallest change: two added lines that pass the products along, for the real page and for the demo. Nothing else in that file moved.

## The intro, for fun

The tabs were ready, but the delivery door belonged to the neighbours.

## The punchline, for fun

So we slipped two lines under it and kept our shoes off the carpet.

## The options, in plain words

A. A. Keep the two lines in this change, the option built.
B. B. Move them to a separate change, and have this one read the products in the browser instead.

## What I had to decide

Whether the two-line change to the Business route, outside this slice's listed ground, is fine, or should move to its own change.

## What I did meanwhile

apps/galaxy/app/app/settings/business/page.tsx passes products: load.products to the page, and products: DEMO_PRODUCTS in the demo. Without it the page cannot draw a tab per product.

## What it costs to change later

Two lines in one route file; reverting them leaves the page with one product only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists this slice's ground as the business and repositories folders and the repositories route; the business route was s2's, and the plan does not say who changes it later.
