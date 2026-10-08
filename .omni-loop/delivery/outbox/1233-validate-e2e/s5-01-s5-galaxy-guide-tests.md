---
id: s5-01-s5-galaxy-guide-tests
prd: 1233
slice: s5
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

Adding the new guide page breaks the website's tests, which list every guide page by hand and sit outside this slice's folder. Should this slice update them?

## The decision, in plain words

The slice updated the website's page-list tests to count the new page, so the guide page and its tests land together.

## The intro, for fun

A new page walks into a guest list that was written by hand.

## The punchline, for fun

The bouncer needed one more name on the list.

## The options, in plain words

A. A. Update the page-list tests in the same slice (built).
B. B. Leave the tests red and let a later change fix them.

## What I had to decide

Whether the guide tests under apps/galaxy may be edited by the slice that adds a guide page.

## What I did meanwhile

The slice edits the two test files to expect fourteen pages, in the new order.

## What it costs to change later

A constant per test: reverting the two test edits and the page together undoes it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No rule in the plan says who may edit the guide tests when a page is added. (author)
