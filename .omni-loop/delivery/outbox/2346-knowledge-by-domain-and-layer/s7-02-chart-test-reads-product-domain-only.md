---
id: s7-02-chart-test-reads-product-domain-only
prd: 2346
slice: s7
rank: medium
bears-on: none
raised: 2026-10-22
wave: 5
---

## The question, in plain words

An arcade test of the knowledge chart read this repository's own knowledge and expected it to hold exactly one area. Now that it holds ten, may the test look at the product area alone, as it meant to?

## The decision, in plain words

The test now lays out this repository's product area by itself, so it still checks that a single area sits in the middle at full size, however many areas the repository grows.

## The intro, for fun

The chart test counted one sun in the sky, and this morning there were ten.

## The punchline, for fun

It now looks at the one sun it came for.

## The options, in plain words

A. Narrow the test to this repository's product area alone (built).
B. Let the test expect every area this repository holds, and update it whenever an area is added.

## What I had to decide

Keep the narrowed test (A), or have the test count every area this repository holds (B).

## What I did meanwhile

Only the test changed, outside this slice's folders; the chart itself is untouched, and every other chart test passes as before.

## What it costs to change later

One line of a test to change back or rewrite; nothing a person sees depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the chart was meant to be tested on this repository's live knowledge at all, or on a fixed one, is not written anywhere (author).
