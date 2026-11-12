---
id: s5-01-meaning-total-counts-every-ranked-entry
prd: 2728
slice: s5
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

When the search ranks by meaning, every entry that has a meaning summary gets a place in the order, so the count the answer gives is close to the size of the whole knowledge. Should the count instead say how many entries are close enough to count as a match?

## The decision, in plain words

The count says how many entries were ranked, as the spec words it, so with meaning it is nearly every entry of the product; agents read the first hits, not the count.

## The intro, for fun

Ask for one law, and the answer says two thousand entries came along for the ride.

## The punchline, for fun

Everything is a little bit relevant, if you squint hard enough.

## The options, in plain words

A. A. The count is every entry ranked, exact, by meaning and by words (as built).
B. B. Only entries within a closeness threshold are ranked by meaning; the count then means close matches.
C. C. Keep the order, and make the count the word matches only, as before.

## What I had to decide

Keep the count as every entry ranked (A), or cut the meaning ranking at a closeness threshold so the count means matches (B).

## What I did meanwhile

Searches by meaning answer a count near the product's size; the hits and their order are unaffected.

## What it costs to change later

B is one threshold constant in the ranking and a test; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No threshold was measured: the spike scored ranks, not distances (author).
