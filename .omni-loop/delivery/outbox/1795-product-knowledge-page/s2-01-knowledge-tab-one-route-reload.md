---
id: s2-01-knowledge-tab-one-route-reload
prd: 1795
slice: s2
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The Knowledge tab sends every change (add, edit, retire, propose, approve, reject, name an owner) through one route, and the page reloads after a change. Is that the shape you want?

## The decision, in plain words

One route takes all seven kinds of change, and the page reloads once a change is saved, so the screen always shows what the database now holds. A new entry's owner is the person who adds it; the page has no control to give an entry to someone else.

## The intro, for fun

The Knowledge tab keeps one front door for every change.

## The punchline, for fun

Seven kinds of change walk in, and the page reloads to greet the result.

## The options, in plain words

A. A. One route for all changes, page reloads after a change (built)
B. B. One route per verb (links, entries, proposals, owners), same reload
C. C. One route, rows update in place without a reload

## What I had to decide

Option A is built. B changes one route into one per verb, and C updates the rows in place without a reload; each is a follow-up slice that touches only the Knowledge tab.

## What I did meanwhile

People use the tab as built: a reload after each change, owners as the person who added the entry.

## What it costs to change later

B or C is one small slice each, inside apps/galaxy/src/product-knowledge/.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reload is acceptable on a product with dozens of entries (author)
