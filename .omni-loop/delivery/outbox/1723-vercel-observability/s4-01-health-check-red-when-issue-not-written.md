---
id: s4-01-health-check-red-when-issue-not-written
prd: 1723
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The hourly health check never fails because an app is down: the issue it opens is the alert. But when it cannot open or update that issue at all, should the run still pass quietly, or turn red?

## The decision, in plain words

It turns red only when it could not write the issue, so the alert is not lost in silence. A down app alone still leaves the run green.

## The intro, for fun

The smoke alarm works fine. It just cannot reach the phone.

## The punchline, for fun

So it beeps in the hallway instead, where someone may hear it.

## The options, in plain words

A. A. Red only when the issue could not be written; green whatever the apps' state (built).
B. B. Green in every case, the failure to write the issue only printed in the run's log.
C. C. Green in every case, with a warning annotation on the run's summary.

## What I had to decide

Keep the run red when the issue could not be written (A), or make it green in every case (B).

## What I did meanwhile

A run that could not open, comment on or close its issue fails; every other run passes, a down app included.

## What it costs to change later

Changing it is one line in the health-check script and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the run exits 0 whatever it found; it does not say what happens when writing the issue fails (author).
