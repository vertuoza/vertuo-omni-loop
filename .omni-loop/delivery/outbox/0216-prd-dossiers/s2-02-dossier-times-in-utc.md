---
id: s2-02-dossier-times-in-utc
prd: 216
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The PRD's page shows when it was opened and the day each version arrived. Whose clock should those times follow?

## The decision, in plain words

Universal time, marked as such, the same for every reader, as the question history page already does. The version picker shows the day only, as the spec's own example does.

## The intro, for fun

A PRD was opened at nine o'clock, which raised the question: nine where?

## The punchline, for fun

The page settled it the way sailors do: one universal clock, and it says so.

## The options, in plain words

A. Universal time, marked as such
B. Each reader's own time zone, taken from their browser
C. The workspace's own time zone, once a workspace carries one

## What I had to decide

Show times in universal time, or in each reader's own time zone.

## What I did meanwhile

The header reads like 27 Sep 2026, 09:12 UTC and each version reads like 27 Sep, both in universal time, so the server and every browser write the same thing.

## What it costs to change later

One formatting function; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the people reading these pages work in more than one time zone is not written anywhere; the history page's own choice was followed.
