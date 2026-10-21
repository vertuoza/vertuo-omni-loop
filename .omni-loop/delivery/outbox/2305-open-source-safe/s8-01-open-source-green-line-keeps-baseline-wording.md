---
id: s8-01-open-source-green-line-keeps-baseline-wording
prd: 2305
slice: s8
rank: medium
bears-on: none
raised: 2026-10-21
wave: 3
---

## The question, in plain words

The guard still prints '0 still in the baseline' although no baseline is left. Should its wording change now?

## The decision, in plain words

The printed lines stay as they were, because a pre-push hook test reads the green line word for word.

## The intro, for fun

A tiny line of text is asking for a tiny edit.

## The punchline, for fun

Nobody has tripped over it yet, so it stays put for now.

## The options, in plain words

A. A. Keep the printed lines as they are (built).
B. B. Change both lines and the hook test in one slice.

## What I had to decide

Pick A to keep the wording until the hook test is updated, or B to change the line and that test in one slice.

## What I did meanwhile

The guard prints the old green and red lines, with a count of 0 that is always true now.

## What it costs to change later

Low: one misleading word in one output line until a later slice rewrites it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The owner of the hook test is not checked by this slice.
