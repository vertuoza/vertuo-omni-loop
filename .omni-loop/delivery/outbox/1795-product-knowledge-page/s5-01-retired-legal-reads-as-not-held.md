---
id: s5-01-retired-legal-reads-as-not-held
prd: 1795
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

When a rule names a Legal entry that the product retired, the check cannot tell it from one that never existed, because the page only lists active entries. Should the page also say which entries were retired?

## The decision, in plain words

The check says the product does not hold the entry for both a retired and an unknown entry. The separate retired message waits until the page lists retired entries.

## The intro, for fun

The page forgets retired entries the moment they leave the list.

## The punchline, for fun

So the check can only say they are gone, not why.

## The options, in plain words

A. A. Say not held for both, as built.
B. B. Add retired ids to the business read and print the retired message.

## What I had to decide

Add a retired list to the business read in a later slice, then the check can print the retired message.

## What I did meanwhile

A retired entry fails the check with the not-held message.

## What it costs to change later

A small addition to the business read and one more line in the check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks for a retired message but fixes the business read to active entries only (author)
