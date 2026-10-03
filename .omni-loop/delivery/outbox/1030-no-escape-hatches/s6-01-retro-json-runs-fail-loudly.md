---
id: s6-01-retro-json-runs-fail-loudly
prd: 1030
slice: s6
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When the retro reads back the record it saved two weeks earlier and finds it in an older shape, should it stop, or carry on and keep the old record as it is?

## The decision, in plain words

It stops, and leaves the comment that says the retro could not run, naming what changed. The record is never kept or rewritten without being read first.

## The intro, for fun

Two weeks is a long time for a note left on a desk.

## The punchline, for fun

Now the retro reads the note before it signs below it.

## The options, in plain words

A. A. Fail the run loudly, with the failure comment naming the field: the option built.
B. B. Keep a run of another shape as it was written, unread, and parse only the runs the retro writes now.
C. C. Drop a run of another shape from the record and write the new run alone.

## What I had to decide

Whether a run kept in the retro's saved record, or a step's saved value, that no longer matches today's shape fails the day-14 run, or is kept as it was and the run carries on.

## What I did meanwhile

Every value read back from a saved step, and every run read back from the saved record on the retro branch, is parsed; one of another shape fails the run, which retries and then posts the usual failure comment naming the step and the field. A saved record that is not the retro's JSON at all is still started again, as before.

## What it costs to change later

A deploy that changes the record's shape while a retro waits for its day-14 run makes that one run fail with a comment, until the shape is loosened in a one-line fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No retro has yet waited across a deploy that changed its record, so how often this fires is not known.
- (author) The spec asks for strict parsing everywhere but does not say what the day-14 run should do with an older record.
