---
id: s4-02-refresh-without-kind-board-only
prd: 1208
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

When the background refresh is started the old way, without saying what kind of work it is for, should it still look up the links?

## The decision, in plain words

No: started the old way it refreshes the PRD's board only, as before. Links are looked up only when it is told the kind, which the status line will do from the next step on.

## The intro, for fun

The old way of asking keeps getting the old answer.

## The punchline, for fun

Nobody gets surprise phone calls to GitHub they did not ask for.

## The options, in plain words

A. A. No kind means the board alone; a kind adds the links (built).
B. B. No kind means a PRD, board and links both.

## What I had to decide

Whether a refresh started without a kind also fetches a PRD's links, or only its board.

## What I did meanwhile

Without a kind it writes the board alone; with the PRD kind it writes the board and the links; with a fix kind, the fix's links alone. A PRD's feature pull request is the open one, else the latest; a fix's pull request and a PRD's phase-0 pull request are listed only while open.

## What it costs to change later

Making the plain refresh fetch links too is a one-line default; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say what a refresh without a kind does, nor which feature pull request to pick when several exist. (author)
