---
id: s3-02-top-five-ties-in-login-order
prd: 612
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When several people have the same count at the edge of a top-5 list, who gets the last places?

## The decision, in plain words

Each list shows exactly five people at most, most first. People with the same count are listed in alphabetical order of their GitHub name, and whoever falls past fifth is left out.

## The intro, for fun

Six people tie for fifth place, and the podium has one step left.

## The punchline, for fun

The alphabet broke the tie, so it is good news for anyone named Aaron.

## The options, in plain words

A. A. At most five, ties in alphabetical order of login, the option built.
B. B. Everyone tied at the fifth count is shown, so a list may run past five.
C. C. At most five, ties broken by who reached the count first.

## What I had to decide

How the three top-5 people lists (most opened, most merged, most reviews) break ties, and whether a tie at fifth place may show more than five people.

## What I did meanwhile

topFive() in apps/galaxy/src/engineering/tally.ts sorts by count, most first, then by login A to Z, and cuts at five; the acceptance criteria's at most five people holds.

## What it costs to change later

A constant change in one function and its test: a different tie-break, or showing everyone tied at fifth.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether people tied at fifth place should all be shown, or marked as tied (author)
