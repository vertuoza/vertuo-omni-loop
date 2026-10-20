---
id: s1-01-what-the-page-check-refuses
prd: 2239
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The new check refuses a review page that loads anything from outside itself. How wide should that be read, and should a section sitting outside both tabs be checked too?

## The decision, in plain words

Anything a browser would fetch from elsewhere is refused, from pictures to scripts and stylesheets, while links a reader clicks stay allowed and styles written inside the page are not searched. Every section is checked, wherever it sits.

## The intro, for fun

A page that phones home is a page that shows nothing in our locked-down frame.

## The punchline, for fun

So the check listens for every call it would place, except the reader's own clicks.

## The options, in plain words

A. Refuse every fetched address on any element, links excepted; leave inline styles unread; check every section wherever it sits (as built)
B. Refuse only what the spec names by example: an outside script, an outside stylesheet and an outside picture
C. As A, and also read the page's inline styles for outside addresses

## What I had to decide

Pick A to keep the check as built, B to narrow it to the three cases the spec names, or C to also read the page's inline styles.
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

The check refuses every fetched address on any element except links, leaves inline styles unread, and grades every section of a page carrying the new marker.

## What it costs to change later

Each answer is a change to one list of names in the page check and its tests; no stored data and no page already written is affected.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A stylesheet pulled in from inside a style block is not caught: the spec names attributes only, so inline styles were left unread (author).
- A responsive-image list is refused whenever it is filled in, even one made only of pictures written inside the page: reading it candidate by candidate was left out, as no page of this shape uses one (author).
