---
id: s2-01-one-offering-one-trade
prd: 748
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Can a business pick several things it sells, or several trades it sells to, or only one of each?

## The decision, in plain words

One of each, like the size: picking another replaces the first. Regions and rivals can be several, each tapped on and off.

## The intro, for fun

The page asked what we sell, and we tried to answer everything.

## The punchline, for fun

It kept the last answer, and kindly set the others aside.

## The options, in plain words

A. One offering and one trade, the option built
B. Several offerings and trades, each chip toggled on and off like regions
C. Several offerings, one trade

## What I had to decide

Whether offering and trade hold one confirmed value or several, on Settings › Business.

## What I did meanwhile

Offering, trade and size hold one confirmed claim each: tapping another chip, typing another value under Other or moving the slider rejects the confirmed claim through claim_set_state, then picks the new one with claim_pick. Region and rival hold several and toggle. The sentence lists every confirmed value of a kind, so data with two offerings still reads right.

## What it costs to change later

One set of kinds in apps/galaxy/src/business/model.ts (SINGLE) and its tests; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says offering and trade chips and region toggles, but never says whether a chip list is one choice or several
