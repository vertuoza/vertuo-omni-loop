---
id: s1-02-business-check-reads-personas
prd: 799
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Should agents get an empty list of personas even for a workspace with no business yet, which meant changing one line of the older business proof?

## The decision, in plain words

The answer always carries the personas list, empty when there is none, so agents never have to guess. The older business proof was updated by one line to expect it.

## The intro, for fun

The old proof knew the answer by heart, and the answer grew a new line.

## The punchline, for fun

One line of homework, and it is back to top of the class.

## The options, in plain words

A. Always carry the list: every answer has personas, empty when none; the business proof changes by one line.
B. Leave it out when there is no business: the proof stays untouched, and the app and the kit fill in an empty list themselves.

## What I had to decide

Whether the answer for a workspace with no business carries an empty personas list, and so whether the business proof may change by that one line.

## What I did meanwhile

Every answer carries personas; the business proof expects the empty list.

## What it costs to change later

Dropping the list from that one answer is a one-line change in the database read and the same one line back in the proof.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says [] when there are none, and does not say whether a workspace with no business counts (author).
