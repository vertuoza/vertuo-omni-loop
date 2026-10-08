---
id: s5-02-width-cut-drops-slice-names
prd: 1208
slice: s5
rank: medium
bears-on: none
raised: 2026-10-08
wave: 5
---

## The question, in plain words

When the bottom line is too wide, should the slice names be dropped whole, keeping only their short ids, or shortened a little at a time?

## The decision, in plain words

Dropped whole: a line too wide shows the slices by their ids only, then shortens the topic, then cuts the line's end.

## The intro, for fun

Every slice has a name, until the terminal gets narrow.

## The punchline, for fun

Then they go by their numbers, like a sports team on a cold day.

## The options, in plain words

A. A. Drop every name at once, keeping the ids (built).
B. B. Trim the names from the last one back, a few characters at a time, before touching the topic.

## What I had to decide

How 'cut the slice names first' is read: dropping every name at once, or trimming them one by one.

## What I did meanwhile

A line too wide drops every slice name at once and keeps the ids, then cuts the topic down to 8 characters, then cuts the line at its end.

## What it costs to change later

Trimming names one by one instead is a change inside one function of the render, with its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the line cuts the slice names first, then the topic; it does not say whether a name is trimmed or dropped. (author)
