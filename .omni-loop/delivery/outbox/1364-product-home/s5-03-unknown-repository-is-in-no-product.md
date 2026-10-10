---
id: s5-03-unknown-repository-is-in-no-product
prd: 1364
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When a repository is not known to any workspace on the Omni page, should the command that lists its products say none, or say it is unknown?

## The decision, in plain words

It says none, as for a known repository in no product: a repository the page does not know is in no product, and the brainstorm then asks no product question.

## The intro, for fun

A stranger knocks and asks which clubs they belong to.

## The punchline, for fun

None yet, says the doorman, which is true and polite.

## The options, in plain words

A. A. Answer none for a repository no workspace lists, as for one in no product.
B. B. Refuse it with 404 'No workspace of yours lists <repo>', and print that line.

## What I had to decide

Whether GET /api/products/which answers {products: []} or a 404 for a repository no workspace of the caller lists, and so whether omni product which prints none or an error.
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

productRepositoriesService.productsOf answers {products: []} when no workspace lists the repository; omni product which prints none and exits 0. The import, by contrast, refuses an unlisted plan repository with 404.

## What it costs to change later

A constant: the service returns the unlisted case as a 404 and the kit prints its reason instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says which prints the products 'or none'; it does not name a repository the page does not know.
