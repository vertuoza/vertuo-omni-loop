---
id: s1-01-closed-session-found-on-post
prd: 142
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

When a terminal's page was closed while that terminal was not asking anything, what should happen to its next question?

## The decision, in plain words

That next question shows in the terminal, and the terminal forgets its closed page, so the question after it opens a fresh tab.

## The intro, for fun

A tab can be closed while its terminal is busy doing something else.

## The punchline, for fun

The terminal notices on its next question, and starts a new tab after that.

## The options, in plain words

A. The question goes to the terminal and the next opens a new tab (built).
B. Open a new tab at once and post this same question there.

## What I had to decide

Whether a question that finds its terminal's page closed goes to the terminal, or opens a fresh tab at once and waits there.

## What I did meanwhile

The question goes to the terminal; the terminal forgets its closed page; the next question opens a new tab.

## What it costs to change later

One question goes to the terminal instead of the page. Changing it is a few lines in the pre hook.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec covers a page closed while a question waits, not one closed between questions; this follows the same rule (author).
