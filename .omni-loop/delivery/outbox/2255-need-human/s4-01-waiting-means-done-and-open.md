---
id: s4-01-waiting-means-done-and-open
prd: 2255
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

Which stopped jobs should the number beside Runners count as waiting for an answer?

## The decision, in plain words

It counts a job only when it stopped to ask a person and its questions are still open, each job once. A job that failed or was cancelled with questions left open is not counted, since nobody can answer those.

## The intro, for fun

A number beside a name should only count the things you can actually do something about.

## The punchline, for fun

Otherwise it would sit at 1 forever, like a missed call nobody can return.

## The options, in plain words

A. Count a stopped job once, only when it ended asking a person and its questions are still open, as the Runners page marks Need human.
B. Count every question still open, whatever became of its job, failed and cancelled ones included.

## What I had to decide

Pick A to count only the jobs that ended asking a person for help and still have open questions, the same jobs the Runners page marks Need human. Pick B to count every open question whatever became of its job, which would also count jobs that failed or were cancelled.

## What I did meanwhile

The number counts the stopped jobs that asked for a person and whose questions are still open, each job once. It looks at every job of the workspace, not only the last 50 the Runners page lists, and a job leaves the count as soon as its questions are answered or dismissed.

## What it costs to change later

Switching to B means the count ignores the state of the job and counts every open question. It is one small change in how the count is worked out, with no stored data and no page changing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The idea says the number counts the workspace's open job questions, but does not say whether a failed or cancelled job whose questions are still open should count, nor whether a job with two open questions counts once or twice.
