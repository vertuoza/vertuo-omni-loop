---
id: s5-01-profile-work-period-by-activity
prd: 698
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

On someone's profile, which PRDs and fixes belong to the chosen week, month or season: the ones they started in that time, or the ones that moved in that time?

## The decision, in plain words

A PRD or a fix shows when something happened on it during the chosen time, even if it was started earlier. That matches how the lists already sort by latest activity.

## The intro, for fun

A PRD started in June and shipped this week: is it this week's news?

## The punchline, for fun

We said yes. Old ideas still count when they finally move.

## The options, in plain words

A. Latest activity within the period (what is built)
B. Started within the period, so an older PRD that moved this week does not show
C. Started or had activity within the period, whichever is later

## What I had to decide

Whether the profile's PRDs, bug fixes and visual updates are chosen by when they were started or by their latest activity.

## What I did meanwhile

Each list keeps the rows whose latest activity falls in the chosen period, newest first.

## What it costs to change later

One date to swap in the profile module; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says each list is filtered by the chosen period without naming which date counts
