---
id: s2-02-waiting-count-from-the-shared-list
prd: 657
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The dashboard's waiting-for-you tile used to read the question tables on its own. Now that the sidebar already read the same questions for the page, should the tile count from that list?

## The decision, in plain words

The tile counts from the list the sidebar read, so the questions are read once per page. A question that is both yours and shared with you now counts once, not twice.

## The intro, for fun

Two people counting the same pile of letters rarely agree on the one addressed to both of them.

## The punchline, for fun

Now one person counts, and that letter counts once.

## The options, in plain words

A. A: count from the list the sidebar read, once per page (built).
B. B: keep the tile's own read of the question tables, a second read per page.

## What I had to decide

Whether counting a question once when it is both yours and shared with you is right, and whether the tile may say it could not load when the sidebar's list could not be read.

## What I did meanwhile

The tile shows the same number as the sidebar's list. When that list cannot be read, the tile says it could not load, and the rest of the dashboard shows.

## What it costs to change later

Low: the tile can go back to its own read by dropping one argument, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a question can be both your own and shared with you in practice was not checked (author).
