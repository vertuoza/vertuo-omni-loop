---
id: s3-02-product-rows-carry-no-domain
prd: 2707
slice: s3
rank: medium
bears-on: none
raised: 2026-11-10
wave: 2
---

## The question, in plain words

Should a search limited to one domain also find the product's terms, Legal entries and Never lines of that domain?

## The decision, in plain words

Terms, Legal entries and Never lines carry no domain in the search, so a search limited to a domain finds only business laws, decisions and rules of that domain. A search without a domain still finds them all.

## The intro, for fun

The glossary knows which domains its words belong to, but the search was not told.

## The punchline, for fun

For now a domain filter only looks at what lives in the repositories and the laws.

## The options, in plain words

A. A. Terms, Legal entries and Never lines carry no domain in the search (built).
B. B. Read each term's domains too, so a search limited to a domain finds its terms.

## What I had to decide

Whether a term should be found by a search limited to one of its domains.

## What I did meanwhile

A search limited to a domain leaves out the product's terms, Legal entries and Never lines.

## What it costs to change later

A constant: one more read of the terms' domains and a list of domains on each entry.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Legal entries and Never lines have no domain in the store at all; only terms do (author).
