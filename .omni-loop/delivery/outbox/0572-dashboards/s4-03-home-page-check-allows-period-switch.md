---
id: s4-03-home-page-check-allows-period-switch
prd: 572
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

An older check says Home must hold no navigation at all, and the new period switch is a small one. Should the check allow it?

## The decision, in plain words

The check now allows exactly one navigation on Home, the period switch, and still refuses any other, such as the old section cards.

## The intro, for fun

An old rule said no signposts on Home, then three little period buttons moved in.

## The punchline, for fun

They got a permit, one sign only, no billboards.

## The options, in plain words

A. A. Allow the period switch as Home's one navigation in the check.
B. B. Draw the period switch without a navigation landmark, leaving the old check as it was.
C. C. Drop the no-navigation part of the old check.

## What I had to decide

How the old no-navigation check on Home treats the board's period switch, since that check lives outside this slice's ground.

## What I did meanwhile

The Home check in src/switch now expects the period switch as the page's only navigation; everything else it checked is unchanged.

## What it costs to change later

One line in one test; nothing shipped depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the period switch should rather be marked up as a plain list than as a navigation (author)
