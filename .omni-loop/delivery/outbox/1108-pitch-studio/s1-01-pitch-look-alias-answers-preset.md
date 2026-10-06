---
id: s1-01-pitch-look-alias-answers-preset
prd: 1108
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

The old address that tells the terminal which look a product uses stays as an alias. Should it keep answering just the look's name, or the full new look with colours and fonts?

## The decision, in plain words

It keeps answering just the name, Arcade or Keynote, taken from the preset the product's look was filled from, so terminals already installed elsewhere keep working unchanged.

## The intro, for fun

An old doorbell, a brand new house: who answers when it rings?

## The punchline, for fun

The old visitors get the same short greeting; the new ones ring the new bell.

## The options, in plain words

A. A. Answer the preset name, as released kits read it (built).
B. B. Answer the whole look (colours, fonts, logo, theme), breaking released kits until they update.
C. C. Answer both: the name under the old key and the whole look under a new one.

## What I had to decide

The spec says the old read stays as an alias that answers the look alone, while released kits read that answer as one of two names. I kept the answer's shape and filled it with the preset the look came from; the full look is on the new read.

## What I did meanwhile

The alias answers the preset name, Arcade for a product with no settings; the new settings read answers everything.

## What it costs to change later

A constant change in one route: answer the look object instead, once no released kit reads the old shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether any kit outside this repository still calls the old read was not measured.
