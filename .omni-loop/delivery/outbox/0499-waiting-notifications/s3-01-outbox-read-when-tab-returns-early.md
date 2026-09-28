---
id: s3-01-outbox-read-when-tab-returns-early
prd: 499
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When you come back to the tab less than a minute after the last outbox check, should the page check again right away, or wait?

## The decision, in plain words

It waits: the outbox is never checked twice within a minute, so a quick return to the tab shows what the last check found, and the next check comes a minute after that return at the latest.

## The intro, for fun

You glance away for ten seconds and come back hoping for news.

## The punchline, for fun

The outbox still answers at most once a minute, like a polite doorman.

## The options, in plain words

A. A. Skip the check when the last one is under a minute old, and check again a minute after the return (built).
B. B. Skip the check, but keep the next one at the minute mark of the last check.
C. C. Always check at once when the tab shows again, even within the minute.

## What I had to decide

Whether 'at once when the tab becomes visible again' or 'never more than once per 60 s' wins when the two meet, and when the next regular check falls after a skipped one.

## What I did meanwhile

A return to the tab within a minute of the last check reads nothing, and the next regular check comes a minute after that return, so the longest gap between two checks stays under two minutes while the tab is visible.

## What it costs to change later

One line in the outbox poller to check again at the minute mark instead of a minute after the return.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for both a check at once when the tab shows again and no two checks within 60 s; it does not say which wins, nor when the next check falls after a skipped one.
