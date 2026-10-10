---
id: s11-02-add-to-a-product-opens-the-tab
prd: 1364
slice: s11
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

On the Products list, where should 'Add to a product' take a repository that is in no product, now that the old settings page no longer picks a product?

## The decision, in plain words

It opens the product's Repositories & approvers tab with that repository already picked: straight to it when the workspace has one product, from a short list of products when it has several, and to the products settings, to make one, when it has none.

## The intro, for fun

The old signpost pointed at a road that was just closed.

## The punchline, for fun

So it now points at the right door, with the key already in the lock.

## The options, in plain words

A. A. Open the product's tab with the repository picked, choosing the product from a list when there are several, the option built.
B. B. Always open a single page that asks which product, then adds the repository there.
C. C. Link to the first product's tab only.

## What I had to decide

Where the Products list's Add to a product link goes once Settings › Repositories drops its product select (settled item s8-02).

## What I did meanwhile

In apps/galaxy/src/products/ProductsHome.tsx, Add to a product links to /app/products/<id>/repositories?add=<repo> for the only product, opens a list of the products (a details element) when there are several, and links to /app/settings/products when there is none. The tab's Add a repository starts on the ?add= repository. A member who follows it lands on the tab read only.

## What it costs to change later

One small component and one query parameter; another target is a change of its links.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says only that repositories in no product are listed 'each with Add to a product', not where it leads with several products or none.
