---
id: s2-02-could-not-check-ends-the-watch
prd: 2410
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When GitHub would not show part of a delivery's first week, should the watch keep asking after the seven days, or stop and say it could not check?

## The decision, in plain words

The watch stops after the seven days and stays marked as could not check, naming what it could not read. A repository of the delivery the app could not read at all is named the same way, so the delivery never reads clean.

## The intro, for fun

GitHub said no to one question, and the watch had to decide how long to keep knocking.

## The punchline, for fun

It knocks for a week, then writes could not check on the door and goes home.

## The options, in plain words

A. Stop after the seven days and leave the delivery as could not check, naming what was not read (built).
B. Keep asking once a day after the seven days until GitHub answers, then close it as clean or broke.

## What I had to decide

Whether a lane whose last look found a read refused (`unread` not empty) ends at its seven days as `watching` with `unread` named, the run then over, rather than looking again each day until GitHub answers; and whether a target the App could not read is named `target <name>` in the unread of the PRD's own lane, which then never closes clean.

## What I did meanwhile

Built as option A in `apps/omni-app/src/main-watch/main-watch.ts` (`finish`, `lanesOf`): the lane stays `watching` with its `unread`, and the page reads it as could not check once `watch_until` has passed.

## What it costs to change later

A constant of one function: looking on after the seven days is a bound on the loop and a rule for when to stop, with no stored shape changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says a refused read keeps the watch watching past its seven days, and does not say whether the App should keep reading after them
- (author) the page reading `target <name>` as could not check is s3's to show
