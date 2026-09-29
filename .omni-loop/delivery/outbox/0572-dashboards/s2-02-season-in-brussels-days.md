---
id: s2-02-season-in-brussels-days
prd: 572
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The Season period on the boards could start at midnight in Brussels or at midnight in London, which is when the game's points reset. Which one should the boards use?

## The decision, in plain words

The boards count the season's days in Brussels time, like the other periods, so the tiles always add up to the charts; the game's points still reset at midnight London time.

## The intro, for fun

Two midnights walk into a month, one hour apart.

## The punchline, for fun

The boards picked the local one and kept the charts honest.

## The options, in plain words

A. Brussels days for the season too, so tiles and charts agree.
B. The exact UTC month for the reads, so the season's edges match the game's to the hour.

## What I had to decide

Whether the season period's window is the UTC month (as the game scores) or its days read in Brussels time (as the charts draw them).

## What I did meanwhile

periodWindow('season') is the UTC month's calendar days, each read in Brussels, up to today: its reads start at the Brussels midnight of the 1st, one or two hours before the UTC month.

## What it costs to change later

One function, periodWindow in src/dashboard/board/period.ts; no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether anyone compares a board's season numbers with a UTC-bounded count (author)
