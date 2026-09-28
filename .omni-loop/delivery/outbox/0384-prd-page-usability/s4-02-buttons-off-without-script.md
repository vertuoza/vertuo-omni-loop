---
id: s4-02-buttons-off-without-script
prd: 384
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 4
---

## The question, in plain words

With scripts turned off, should a quick question still show its one-click buttons, even though a click cannot send anything?

## The decision, in plain words

The buttons still show but stay greyed out until the page's script is running; without a script, the link to the question's own page is the way to answer.

## The intro, for fun

A doorbell that is not wired yet still looks like a doorbell.

## The punchline, for fun

So it stays greyed out until the wiring arrives, and the side door is right there.

## The options, in plain words

A. A. Show the buttons greyed out until the script runs: what was built; the page does not jump when the buttons switch on.
B. B. Hide the buttons until the script runs, and show the plain option list instead: nothing on screen that cannot be clicked, but the round changes shape once loaded.

## What I had to decide

How a quick question looks before, or without, the page's script: the buttons hidden, shown but off, or shown and dead.

## What I did meanwhile

The buttons render greyed out on the server and switch on once the script runs; the link to the question's own page is always there.

## What it costs to change later

One condition in the one-click piece; hiding them instead is a small change to that piece and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a quick question with no script shows its link, but not whether the buttons should be hidden or shown greyed out.
