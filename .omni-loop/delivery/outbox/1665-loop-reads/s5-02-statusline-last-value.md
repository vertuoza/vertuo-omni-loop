---
id: s5-02-statusline-last-value
prd: 1665
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When the status line's background refresh cannot read the loop, what should the status line show?

## The decision, in plain words

It shows what it shows today when the refresh fails: the PRD's line without the slices, never an error, and it tries again a minute later.

## The intro, for fun

The scoreboard lost its feed, so it kept the match title up and the score off.

## The punchline, for fun

A minute later it asks again, politely, without a single red light.

## The options, in plain words

A. A. Keep today's behaviour: on a failed read the line drops the slices and tries again a minute later.
B. B. Keep the last good slices on screen, marked as old, until a read works again.

## What I had to decide

Whether 'keeps the last value it drew' (spec, Behaviour; plan s5 done-when) means today's behaviour, where a failed refresh writes the error entry and the line drops the board, or keeping the last good slices on screen past a failed read.

## What I did meanwhile

refreshPrdBoard writes the LoopReadError's own line as the error entry (kit/lib/statusline/board-cache.ts unchanged); the status line then draws the stage alone, and kit/bin/statusline.test.ts proves the line drawn after a failed read is the line drawn before it, with no error text.

## What it costs to change later

Keeping the last slices means writing the old slices back with their old time in board-cache.ts, outside this slice: a small change, but it would also need its own retry timer.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'as it does today when gh fails', which is what was built; the done-when's 'draws its last value' could also mean the last slices.
