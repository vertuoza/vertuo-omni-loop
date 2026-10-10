---
id: s7-01-picker-reads-after-load
prd: 1364
slice: s7
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

Should the Product choice on a PRD's page be there the moment the page opens, or may it appear a moment later?

## The decision, in plain words

The Product choice appears a moment after the page opens, once it has asked who may change it. Everything else on the page shows as before.

## The intro, for fun

Some guests arrive with the party already started.

## The punchline, for fun

The Product choice walks in half a second late, but it brings the right list.

## The options, in plain words

A. Appear once read: the browser draws the cell after it asks the server, and the first paint is unchanged.
B. Part of the first paint: the server reads the product with the rest of the page, so the cell is there from the start.

## What I had to decide

Whether the Product choice may appear just after the page opens, or must be part of the first paint.

## What I did meanwhile

The page opens as it did before; the Product cell joins the facts row as soon as it has read the PRD's product and the workspace's products. A person who may not change it never sees the cell.

## What it costs to change later

Option B moves the read into the page's server render: it changes the page's route and its view, outside this slice, and the cell's own code stays as is.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The select uses the browser's default look: the page's stylesheet was outside this slice, so it has no style of its own yet (author).
