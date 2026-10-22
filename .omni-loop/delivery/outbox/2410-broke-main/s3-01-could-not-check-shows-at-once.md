---
id: s3-01-could-not-check-shows-at-once
prd: 2410
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When GitHub refused one read during the seven days, should the page say Could not check right away, or keep saying Watching until the seven days end?

## The decision, in plain words

The page says Could not check as soon as a watch holds an unread signal, and Broke main always wins over it. A watch that is still within its seven days and has nothing unread says Watching.

## The intro, for fun

One refused read, and the page cannot decide whether to worry.

## The punchline, for fun

It worries early; a quiet false alarm beats a loud missed one.

## The options, in plain words

A. Could not check as soon as a signal is unread (built).
B. Watching until the seven days end, then Could not check.

## What I had to decide

Whether Could not check shows during the seven days or only after them. The spec says a refused read keeps the watch watching and marked could not check past its seven days, and the acceptance line says a PRD whose reads were refused reads Could not check.

## What I did meanwhile

Built so any unread signal on a watch still being watched reads Could not check, whatever the days left.

## What it costs to change later

A constant: the rule is one condition in main-watch/status.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say whether a refusal on day one already reads Could not check
