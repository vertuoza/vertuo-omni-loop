---
id: s1-01-own-question-counts-while-page-can-answer
prd: 499
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Should a question from your own terminal count as waiting for as long as it stays open, or only while the page can still answer it?

## The decision, in plain words

It counts only while the page can still answer it: once the terminal has taken the question back, after nine minutes, it stops counting, exactly as the home page's Waiting for you tile already counts.

## The intro, for fun

A question left open overnight still looks like it is waiting for you.

## The punchline, for fun

We only count the ones you can still actually answer.

## The options, in plain words

A. Count a question while the page can still answer it, like the home page's tile (built).
B. Count every question still marked open, even after the terminal took it back.

## What I had to decide

Whether the count follows the page's own nine-minute answering window, or every question still marked open.

## What I did meanwhile

The count, the menu badges and the title follow the home page's rule: a question counts while the page can answer it.

## What it costs to change later

One line in the waiting list's own-question rule to count every open round instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names both 'status open' and the ask pages' own readers, which apply the nine-minute window; it does not say which wins when they differ.
