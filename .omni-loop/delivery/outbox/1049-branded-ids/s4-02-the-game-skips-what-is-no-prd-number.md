---
id: s4-02-the-game-skips-what-is-no-prd-number
prd: 1049
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 3
---

## The question, in plain words

When the game reads a number that no real PRD can have, such as PRD zero in a spec's list of blockers or in a pull request's link line, should it stop or carry on without it?

## The decision, in plain words

The game carries on without it, as the arcade already does: a blocker or a link that names no real PRD is left out. What GitHub itself answers is still checked strictly.

## The intro, for fun

Somewhere a spec claims to wait for PRD zero.

## The punchline, for fun

The game stopped waiting for it.

## The options, in plain words

A. A. Lenient readers leave out a number that is no PRD number; GitHub's answers parse strictly (built).
B. B. Every reader fails on such a number, so one bad spec line stops the poll.

## What I had to decide

Whether the game's lenient readers (a spec's `blocked-by` list, a merged pull request's `Refs #n` or `Closes #n` link, a delivery folder's number) drop a value that is no PRD number, or fail.

## What I did meanwhile

They drop it, as item s3-03 settled for the arcade: `blocked-by: [0, #985]` reads as [985] (it used to keep 0 and negatives), and `Closes #0` marks no PRD stage (it used to credit PRD 0). The lists GitHub answers (issues, pull requests, bugs) are parsed strictly; GitHub never sends a zero.

## What it costs to change later

One line per reader: the safe parse swapped for the throwing one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a value a schema now refuses fails loudly where it reads; the game's readers have always skipped what they cannot read (the game's spec, section 8), so they skip here too, following s3-03.
