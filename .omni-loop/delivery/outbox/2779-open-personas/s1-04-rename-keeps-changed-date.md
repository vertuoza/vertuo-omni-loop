---
id: s1-04-rename-keeps-changed-date
prd: 2779
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When the update moves every excited persona to enthusiastic, should each persona's last-changed date move to the day of the update, or stay the day a person last changed it?

## The decision, in plain words

The last-changed date stays as a person left it. The move is still written in the knowledge history, one line per persona, saying it was excited before and enthusiastic after, and that no person made it.

## The intro, for fun

Nobody edited these personas, yet their word changed overnight.

## The punchline, for fun

The history knows; the date shown on the page does not pretend.

## The options, in plain words

A. A. The changed date stays as a person left it; the history records the move.
B. B. The changed date becomes the day of the update, as well as the history line.

## What I had to decide

Keep A when the page's changed date should mean a person changed it. Pick B when it should show every change, the update's included.

## What I did meanwhile

Each moved persona keeps its changed date, and gains one history line, by no one. The way the update moves them stays in the database, so its check can prove it again on fresh rows.

## What it costs to change later

B is one more column set in the update's move, before it ships; after it ships, a new migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the move is recorded with no person, and says nothing of the changed date the page shows (author).
- Keeping the move as a function the update calls once lets the database check prove it on rows stored the old way; it is never run by anyone signed in.
