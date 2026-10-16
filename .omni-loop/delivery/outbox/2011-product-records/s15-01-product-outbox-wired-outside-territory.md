---
id: s15-01-product-outbox-wired-outside-territory
prd: 2011
slice: s15
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

A product PRD's Outbox tab needed its rows handed to the page from two files the plan did not list for this slice. Is that wiring fine where it is?

## The decision, in plain words

I added one small read to the PRD page's route and one optional piece of input to the page itself, so a product PRD's Outbox tab can show its server items. A repository PRD's tab is untouched.

## The intro, for fun

The tab was built; somebody had to plug it in.

## The punchline, for fun

Two sockets, one plug, no sparks.

## The options, in plain words

A. A. Keep the read in the route and the optional input on the page (built).
B. B. Move the read into the view builder so the tab badge counts the items too.

## What I had to decide

The slice territory names only the Outbox pane files, but the tab can only show server rows if the route reads them and the page passes them down. I touched DossierRoute.tsx (reads the rows only on a product PRD's Outbox tab) and DossierPage.tsx (an optional productOutbox input that picks the product pane). The other option was a client component fetching through a new API route, which is a bigger change outside the territory too.

## What I did meanwhile

Built the two edits as small and optional as possible: with no productOutbox the page renders exactly as before.

## What it costs to change later

Moving the read elsewhere later is a few lines in one route file and one prop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The tab bar badge for a product PRD still reads from GitHub, so it shows no count of open items (author).
