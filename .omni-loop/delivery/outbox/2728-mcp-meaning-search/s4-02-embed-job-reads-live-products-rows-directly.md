---
id: s4-02-embed-job-reads-live-products-rows-directly
prd: 2728
slice: s4
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

To prepare a product's legal entries, terms and never lines for the meaning search, the background job must read them. Which products count, and where does it read them from?

## The decision, in plain words

It reads them straight from where the product keeps them, for every product that holds the repository and is not archived, and leaves out who owns each legal entry.

## The intro, for fun

An archived product is like a closed shop: the lights are off, so nobody restocks the shelves.

## The punchline, for fun

If it reopens, the next merge stocks it again by itself.

## The options, in plain words

A. A. Read the rows of live products straight from their tables, with no owner (built).
B. B. Include archived products too.
C. C. Add a database function for the service role that answers a repository's products and their rows, and read through it.

## What I had to decide

Whether archived products are skipped (as built) and whether the job reads the product's rows directly, as the MCP reads its never lines, rather than through one database function.

## What I did meanwhile

The MCP of an archived product does not answer, so nothing is lost; an unarchived product's rows are embedded at its next pack, or by the search itself.

## What it costs to change later

Including archived products is one filter removed; reading through a database function is one new function and a swap of the store's reads.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The function the MCP reads these rows through is closed to the service role, so the job reads the same tables with the same filters instead.
