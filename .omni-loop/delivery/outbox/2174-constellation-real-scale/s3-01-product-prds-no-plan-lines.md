---
id: s3-01-product-prds-no-plan-lines
prd: 2174
slice: s3
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

Product PRDs written on the server (such as mobile-12) are not read for plan lines, only the numbered PRDs of the product are. Should they draw lines too?

## The decision, in plain words

The map reads the targets of the product's numbered PRDs only, because only those carry a stage and a place on the Ledger that says whether they are in flight.

## The intro, for fun

Some PRDs have a number, others a key, and the map only counts the first kind.

## The punchline, for fun

Giving the others a seat at the table is one more read away.

## The options, in plain words

A. A. Read only the numbered PRDs (built).
B. B. Read the product PRDs' targets too, marking them in flight while they are not shipped.

## What I had to decide

Option A is built: the map's lines come from the numbered PRDs. Choose B to add the product PRDs, which needs a way to tell whether each is in flight.

## What I did meanwhile

A product with only server-born PRDs draws its stars and no plan line.

## What it costs to change later

B adds one read and an in-flight rule for product PRDs; it undoes nothing built here.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether product PRDs should draw lines was not in the spec (author).
