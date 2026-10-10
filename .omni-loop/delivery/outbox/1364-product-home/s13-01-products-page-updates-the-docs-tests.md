---
id: s13-01-products-page-updates-the-docs-tests
prd: 1364
slice: s13
rank: medium
bears-on: none
raised: 2026-10-10
wave: 4
---

## The question, in plain words

The guide gets a new Products page, but the two tests that list every page of the guide live outside this slice's agreed area. Should the page be added anyway?

## The decision, in plain words

Yes: the Products page sits after Drive the loop and leads to Several repositories, and the two tests that list the guide's pages now count sixteen and name it, so the checks stay green.

## The intro, for fun

A new page walked into the guide's table of contents.

## The punchline, for fun

The table's guest list had to be reprinted to let it in.

## The options, in plain words

A. A. Add the page after Drive the loop and update the two docs tests, the option built.
B. B. Put the products text inside Several repositories and the index, with no new page and no test change.
C. C. Add the page elsewhere in the order, such as after Ideas board.

## What I had to decide

Whether a slice that adds a guide page may change the tests that pin the guide's list of pages, and where the page sits in the guide's order.

## What I did meanwhile

Added products.md to meta.json after drive, with its Next link to several-repositories; apps/galaxy/src/docs/guide.test.ts and docs.test.ts list it (order, titles, Next links, sidebar, page count sixteen) and guide.test.ts gains one test of what the page and several-repositories.md say.

## What it costs to change later

A constant: moving the page in the order is a one-line change to meta.json and the same lists in the two tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether readers would rather find Products after Several repositories or near Ideas board (author)
