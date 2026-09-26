---
id: s2-02-empty-page-picks-nothing
prd: 142
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

When the page opened with no terminal asking and a first terminal then shows up, should the page select it on its own?

## The decision, in plain words

The new terminal appears in the list with its badge, and the page asks the person to pick it; nothing is selected for them.

## The intro, for fun

The page sat empty, then a terminal knocked.

## The punchline, for fun

It waves from the list and waits to be picked, like a well-mannered guest.

## The options, in plain words

A. Show the new tab and let the person pick it (built).
B. Select the first tab that arrives when nothing is selected yet, and never switch after that.

## What I had to decide

Whether the page may select a tab by itself when nothing is selected yet.

## What I did meanwhile

A page opened empty keeps reading the list; tabs that arrive show with their badge, and the pane says to pick one.

## What it costs to change later

Selecting the first arrival instead is one line in the page's state rule, with no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the page never switches tabs by itself; whether that covers a page with nothing selected is not said (author).
