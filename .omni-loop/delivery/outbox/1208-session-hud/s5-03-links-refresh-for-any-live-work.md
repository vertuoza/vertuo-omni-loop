---
id: s5-03-links-refresh-for-any-live-work
prd: 1208
slice: s5
rank: medium
bears-on: none
raised: 2026-10-08
wave: 5
---

## The question, in plain words

Should the bottom line keep the links fresh for any work that is not finished, including a PRD still in review, and not only where the board is kept?

## The decision, in plain words

Yes: the links are refreshed about once a minute for a PRD that is not shipped, in review included, and for a fix not yet merged; never for finished work.

## The intro, for fun

A PRD in review has the most interesting link of all: its open review.

## The punchline, for fun

So it gets its fresh links too, once a minute, no more.

## The options, in plain words

A. A. Refresh the links of any work not finished, in review included (built).
B. B. Refresh them only alongside the board, for a PRD in the inbox on the main branch, and for fixes.

## What I had to decide

For which work the status line starts the background refresh of the links, since the board's refresh only runs for a PRD in the inbox on the main branch.

## What I did meanwhile

The board's refresh now also keeps the PRD's links. Beside it, the status line starts a links refresh for the work the session is on when its links are missing or a minute old and no refresh holds them, once per render, for a PRD not shipped and a fix not merged. A PRD refresh also rebuilds its board.

## What it costs to change later

Narrowing it to the PRDs whose board is refreshed is one condition in the status line command.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the links are refreshed as the board is; it does not say whether that covers a PRD in review, whose phase-0 link only exists then. (author)
