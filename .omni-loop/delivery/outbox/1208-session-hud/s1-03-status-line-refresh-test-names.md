---
id: s1-03-status-line-refresh-test-names
prd: 1208
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

The status line's own test checks the exact file its background refresh writes. Now that the file also keeps each slice's name, may this slice update that test?

## The decision, in plain words

Yes: the status line's refresh test now expects each slice's name in the file, and nothing else about it changed.

## The intro, for fun

The board learned everyone's name, and the old guest list did not know them yet.

## The punchline, for fun

So the guest list got a quick update, spelling checked.

## The options, in plain words

A. A. Update the status line's refresh test to expect the names (built).
B. B. Keep the names in a separate file so the status line's test stays as it was.

## What I had to decide

Whether the status line's refresh test, outside this slice's ground (kit/bin/statusline.test.ts), may be updated to expect the new slice names.

## What I did meanwhile

The test expects the names; no status line code changed.

## What it costs to change later

Four names in one test; a later slice that owns the status line can reshape them freely.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the board names to this slice but the status line test that checks the board file to slices s4 and s5. (author)
