---
id: s3-01-install-pr-lines-after-closing-steps
prd: 420
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When the install command has opened the install pull request, where in its closing message does it say so, and what does it do when a previous run already left the install branch behind?

## The decision, in plain words

The install pull request gets its own short block at the very end of the message, after the steps a person still takes by hand. A rerun moves back onto the install branch a previous run left, instead of stopping.

## The intro, for fun

The install command finished its chores and wanted to tell someone.

## The punchline, for fun

It waited politely until everyone else had spoken, then said it last.

## The options, in plain words

A. A separate block at the end of the message; a rerun switches back to the existing install branch (built).
B. Print the install lines at the top, before the files written, in the order the steps ran.
C. Fold them into the closing steps now, replacing the commit-and-merge-by-hand line.

## What I had to decide

Whether the install pull request lines stay as the last block, or move into the closing steps when the next slice rewrites them.

## What I did meanwhile

Until the next slice rewrites the closing steps, the message still says to commit and merge by hand above the block that says the commit and pull request are done.

## What it costs to change later

Moving the block is a few lines in one file and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec orders the steps but does not say where their status lines print relative to the existing closing steps
