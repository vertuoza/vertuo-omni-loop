---
id: s11-01-tab-joins-the-product-home-tabs
prd: 1364
slice: s11
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The new Repositories & approvers tab has to show in the product page's row of tabs, which another slice of this wave owns. Who adds it there?

## The decision, in plain words

This slice adds the one tab to that row itself, so the tab can be reached from the product page; the other slice adding its own tabs at the same time may have to line the two up when they are merged.

## The intro, for fun

Two crews are hanging signs on the same corridor on the same day.

## The punchline, for fun

One of them will have to slide a sign over a little.

## The options, in plain words

A. A. Add the tab to the product home's tab row in this slice, the option built.
B. B. Leave the tab row to s10, and reach the tab only by its address until then.
C. C. Draw a separate tab row on the new page only, and let the wave join the two later.

## What I had to decide

Whether this slice adds its tab to the product home's tab row (src/product-home/ProductHome.tsx and its render test), outside its territory, or leaves it to s10 or the wave.

## What I did meanwhile

Exported productHomeTabs() from apps/galaxy/src/product-home/ProductHome.tsx and appended { href: /app/products/<id>/repositories, label: 'Repositories & approvers' } to it; apps/galaxy/src/product-home/product-home.render.test.ts expects the third tab. The tab's page draws the same row from productHomeTabs(). s10 (same wave) adds its own tabs to that function, so merging the two sub-PRs may need the array lined up by hand.

## What it costs to change later

One line in one array, plus one line in its test; moving it later is a cut and paste.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives src/product-home/ to s9 and s10 only, and does not say which slice wires the Repositories & approvers tab into the product home's tab row.
