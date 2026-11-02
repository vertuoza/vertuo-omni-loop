---
id: s2-02-clearing-a-terms-domains-keeps-retired-links
prd: 2583
slice: s2
rank: medium
bears-on: none
raised: 2026-11-02
wave: 2
---

## The question, in plain words

When someone clears a term's domains, should the links to domains that were retired since also go? This slice keeps them, because the spec says a link made before retirement stays.

## The decision, in plain words

Emptying a term's domains removes the links to the domains that are still active and keeps the ones to retired domains, which the term keeps showing as retired. A person who wants one gone has no control for it yet.

## The intro, for fun

A retired domain left the building, but its name tag stayed on the term.

## The punchline, for fun

Clearing the list is tidying, not erasing history.

## The options, in plain words

A. A. Keep retired links when a term's domains are cleared or replaced.
B. B. Remove retired links as well when the list is cleared or replaced.
C. C. Keep them, and add a control on the term's page to remove one retired link at a time.

## What I had to decide

Answer A to keep retired links when a term's domains are cleared or replaced; answer B to remove them too, so clearing really empties the list.

## What I did meanwhile

The wave carries on with retired links kept, as the spec words it.

## What it costs to change later

Undoing it is changing one delete rule in the database function and its check; the links already kept stay in the table.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a link made before a domain was retired stays, but not whether a person may remove it on purpose.
