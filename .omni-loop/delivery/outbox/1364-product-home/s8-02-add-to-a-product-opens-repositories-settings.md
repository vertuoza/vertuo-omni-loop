---
id: s8-02-add-to-a-product-opens-repositories-settings
prd: 1364
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

Where does 'Add to a product' take a person, beside a repository that is in no product?

## The decision, in plain words

It opens the repositories settings page, where a repository is given a product today. Once the product page can add repositories, it can point there instead.

## The intro, for fun

A lonely repository raises its hand, and the button has to know where to send it.

## The punchline, for fun

So it goes to the one door already open, until a nicer one is built.

## The options, in plain words

A. Open Settings › Repositories, the option built.
B. Open a picker of the workspace's products right on the card list.
C. Open the first product's Repositories & approvers tab with the repository filled in.

## What I had to decide

The target of the 'Add to a product' link on /app/products.

## What I did meanwhile

A plain link to /app/settings/repositories (ADD_TO_PRODUCT_HREF in ProductsHome.tsx), the same for every repository.

## What it costs to change later

One constant; s11 owns src/products/ and can repoint it to the product home's Repositories tab.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether s11 should turn it into a picker of the workspace's products in place
