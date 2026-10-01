---
id: s2-02-history-times-in-utc
prd: 871
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

In the History drawer of the product's lines, should each change's date and time read in the reader's own time zone or in one shared time?

## The decision, in plain words

Every change shows its date and time in UTC, the same for every reader, so every reader sees the same moment.

## The intro, for fun

Two owners in two cities argued over when the line was edited.

## The punchline, for fun

We gave them one clock, and both of them grumbled equally.

## The options, in plain words

A. UTC for everyone, the same on the server and in the browser (built).
B. The reader's local time, drawn in the browser after the page loads.
C. A relative time (3 h ago) with the exact UTC time beside it.

## What I had to decide

Whether the History drawer should show times in the reader's local time instead of UTC.

## What I did meanwhile

Times read like 1 Oct 2026, 09:12 UTC, drawn the same on the server and in the browser.

## What it costs to change later

Switching to local time is a change to one formatting function and its test; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks for the date and time of each event but does not say in which time zone (author).
