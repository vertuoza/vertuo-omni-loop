---
id: s1-02-five-hour-reset-time-read
prd: 324
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Claude Code tells the status line when the 5-hour usage resets, but the spec says neither in which form that moment comes nor how to count a minute that has only started. How should the line read it?

## The decision, in plain words

A number is read as seconds since 1970, and a text as a date. The time left counts a started minute as a whole one, so the last minute before the reset reads 1m, never 0m.

## The intro, for fun

The clock says when the window reopens, but not which way it tells the time.

## The punchline, for fun

Both ways are understood, and the countdown never reaches zero before the reset does.

## The options, in plain words

A. Seconds since 1970 or a date, minutes rounded up so the last minute reads 1m: the option built.
B. Seconds since 1970 or a date, minutes rounded down, so the last minute before the reset reads 0m.
C. Seconds since 1970 only: a moment sent as a date leaves the usage out of the line.

## What I had to decide

Whether `rate_limits.five_hour.resets_at` is read as Unix seconds, milliseconds or an ISO date, and whether the time to it rounds its minutes up or down.

## What I did meanwhile

A number is read as Unix seconds and a text as a date; anything else leaves the usage part out. The time left is counted in whole minutes rounded up: 30 seconds read `1m`, 44 minutes and a second read `45m`, 59 minutes and 30 seconds read `1h00`. The spec's own cases, `45m` and `1h05`, read the same either way.

## What it costs to change later

One function in `kit/lib/statusline/input.mjs`, one in `kit/lib/statusline/render.mjs`, and their tests. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the field but not its form: Claude Code's documentation, which is not in this repository, is the authority, and nothing here was checked against a live payload.
- (author) The spec gives `45m` and `1h05` but not how a part of a minute is counted.
