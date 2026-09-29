---
id: s2-04-board-dividers-listed
prd: 572
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new boards draw faint lines between table rows and behind the charts, and a test elsewhere in the app lists which lines may stay faint. Should they join that list, though the test belongs to another part of the app?

## The decision, in plain words

I added the boards' two kinds of faint line to the list, the way the old week chart and rankings table are listed, so they stay quiet dividers.

## The intro, for fun

Some lines are meant to be seen, and some only to keep the peace.

## The punchline, for fun

The boards' lines signed up for peacekeeping duty.

## The options, in plain words

A. Keep them listed as quiet dividers.
B. Draw them with the strong line colour and leave the test's list alone.

## What I had to decide

Whether the board's grid lines and table cell borders keep --ask-line (dividers) by being listed in apps/galaxy/src/ask/outlines.test.ts, a file outside s2's territory, or switch to --ask-line-strong.

## What I did meanwhile

Added 'dashboard/board/board.css .board-grid' and '.board-table td' to DIVIDERS; also dropped a hover opacity on the chart bars that the same test forbids.

## What it costs to change later

Two lines in a test's list, or two colour tokens in board.css.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the owner of that test wants new pages to extend its list (author)
